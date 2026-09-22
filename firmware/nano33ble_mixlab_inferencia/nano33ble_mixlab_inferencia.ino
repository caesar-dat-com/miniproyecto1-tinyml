/* ============================================================================
 * MixLab — Nano 33 BLE: inferencia a bordo + streaming crudo
 * Miniproyecto 1 TinyML · UAO 2026-2 · Grupo 2
 *
 * Dos modos, elegibles por comando BLE desde la app:
 *
 *   MODO INFERENCIA (por defecto)
 *     Muestrea el acelerometro a 62,5 Hz (16 ms, el intervalo EXACTO con el
 *     que se capturo el dataset), llena una ventana de 125 muestras x 3 ejes
 *     con paso 25, normaliza con la media/desviacion del entrenamiento y
 *     corre el modelo Conv1D int8 con TensorFlow Lite Micro.
 *     Emite una linea JSON compacta por ventana:
 *
 *         {"g":"agitar","p":0.87}
 *
 *   MODO STREAMING (el de siempre, 50 Hz)
 *     Emite las lineas "D," que la app usa en el Taller para ver la señal
 *     viva y para grabar dataset. Se mantiene intacto.
 *
 * PROTOCOLO DE COMANDOS (escribir en la caracteristica RX)
 *     'i'  -> modo inferencia
 *     's'  -> modo streaming crudo
 *     'p'  -> pausa el envio
 *     'r'  -> reanuda el envio
 *
 * LIBRERIAS
 *     ArduinoBLE
 *     Arduino_LSM9DS1            (o Arduino_BMI270_BMM150 en las Rev2)
 *     Chirale_TensorFLowLite     <- TensorFlow Lite Micro para mbed_nano
 *
 *     OJO: la vieja "Arduino_TensorFlowLite" de Sandeep Mistry YA NO ESTA en
 *     el gestor de librerias (arduino-cli la reporta como "not found"). El
 *     reemplazo vivo para Nano 33 BLE es Chirale_TensorFLowLite, que es la
 *     misma TFLM empaquetada para Arduino:
 *         arduino-cli lib install Chirale_TensorFLowLite
 *
 * DE DONDE SALEN LAS CONSTANTES
 *     Todas (MEDIA, DESV, VENTANA, N_EJES, CLASES_C y el modelo) viven en
 *     modelo_via_b.h, que es una copia literal de notebooks/via_b_int8.h.
 *     Para re-sincronizarlo despues de un reentreno:
 *         ./firmware/tools/sync_modelo.sh
 *     No hay constantes escritas a mano en este sketch: si se reentrena, el
 *     script las trae y aqui no se toca nada.
 * ========================================================================= */

#include <ArduinoBLE.h>

/* dtostrf no viene por defecto en el core mbed: el printf de mbed no trae
   coma flotante y dtostrf vive en la capa de compatibilidad con AVR. */
#include <avr/dtostrf.h>

/* OJO con el nombre de este define: Arduino_LSM9DS1 hace internamente
   "#define IMU IMU_LSM9DS1", asi que un define propio llamado IMU_LSM9DS1
   deja el objeto IMU en nada y el sketch no compila. Por eso USAR_*. */
#define USAR_LSM9DS1
// #define USAR_BMI270

#ifdef USAR_LSM9DS1
  #include <Arduino_LSM9DS1.h>
#else
  #include <Arduino_BMI270_BMM150.h>
#endif

#include <Chirale_TensorFlowLite.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

/* Modelo + normalizacion + etiquetas, generados por el notebook 03. */
#include "modelo_via_b.h"

/* ---------------------------------------------------------------- ajustes */
static const char* NOMBRE_BLE = "MixLab";

/* Streaming crudo: se queda en 50 Hz. Con el MTU por defecto una notificacion
   lleva 20 bytes utiles y una muestra ocupa ~40 caracteres, asi que a mas de
   50 Hz la radio no da abasto. */
static const uint16_t STREAM_HZ  = 50;
static const uint32_t STREAM_US  = 1000000UL / STREAM_HZ;

/* Inferencia: 16,0 ms = 62,5 Hz. Es el intervalo con el que se capturo el
   dataset; cambiarlo descuadra la ventana respecto al entrenamiento. */
static const uint32_t INFER_US   = 16000UL;
static const int      PASO       = 25;      // solapamiento: 100 de 125 muestras

/* El dataset de Edge Impulse esta en m/s2 (los .cbor declaran units "m/s2"),
   pero IMU.readAcceleration() de Arduino devuelve g. Sin este factor la
   normalizacion entra con una escala 9,8 veces menor y el modelo predice
   cualquier cosa. Si algun dia se reentrena con datos en g, poner 1.0f. */
static const float G_A_MS2 = 9.80665f;

static const int N_CLASES_H = (int)(sizeof(CLASES_C) / sizeof(CLASES_C[0]));

/* Servicio UART de Nordic: el de facto para "serie sobre BLE".
   NO tocar: es lo que la app ya escucha. */
static const char* UUID_SERVICIO = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* UUID_TX       = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // placa -> app
static const char* UUID_RX       = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // app -> placa

BLEService        servicio(UUID_SERVICIO);
BLECharacteristic txChar(UUID_TX, BLENotify, 20);
BLECharacteristic rxChar(UUID_RX, BLEWrite,  20);

/* ------------------------------------------------------------------ estado */
enum Modo { MODO_INFERENCIA, MODO_STREAM };
Modo     modo          = MODO_INFERENCIA;
bool     enviandoDatos = true;
uint32_t proximaMuestra = 0;

/* Ventana circular de 125 x 3 en unidades fisicas (m/s2), sin normalizar.
   Se normaliza al momento de copiar al tensor: asi un cambio de MEDIA/DESV
   no obliga a vaciar la ventana. */
float   ventana[VENTANA][N_EJES];
int     escritura   = 0;   // proxima posicion a escribir
int     llenas      = 0;   // muestras validas acumuladas (satura en VENTANA)
int     desdeUltima = 0;   // muestras nuevas desde la ultima inferencia
float   ultAx = 0, ultAy = 0, ultAz = 0;   // ultimo valor leido, para huecos

/* ------------------------------------------------------------------- TFLM */
const tflite::Model*      model       = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
TfLiteTensor*             input       = nullptr;
TfLiteTensor*             output      = nullptr;
bool                      modeloListo = false;

/* El arena se dimensiona a ojo y se ajusta con el aviso que imprime setup().
   Para este Conv1D (15,6 KB de pesos, ventana 125x3) 24 KB sobran de largo
   en los 256 KB de RAM del nRF52840. */
constexpr int kTensorArenaSize = 24 * 1024;
alignas(16) uint8_t tensor_arena[kTensorArenaSize];

/* ==========================================================================
 * Envio por BLE en trozos de 20 bytes.
 * La webapp reensambla por '\n', asi que partir una linea no rompe nada.
 * ======================================================================= */
void enviar(const char* s) {
  size_t n = strlen(s);
  size_t i = 0;
  while (i < n) {
    size_t trozo = (n - i > 20) ? 20 : (n - i);
    txChar.writeValue((const uint8_t*)(s + i), trozo);
    i += trozo;
  }
}

/* --------------------------------------------------------- arranque TFLM */
bool iniciarModelo() {
  model = tflite::GetModel(modelo_via_b);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println(F("Modelo con version de schema distinta a la libreria"));
    return false;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter intr(model, resolver, tensor_arena, kTensorArenaSize);
  interpreter = &intr;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println(F("AllocateTensors fallo: sube kTensorArenaSize"));
    return false;
  }

  input  = interpreter->input(0);
  output = interpreter->output(0);

  Serial.print(F("Arena usada: "));
  Serial.print(interpreter->arena_used_bytes());
  Serial.print(F(" de "));
  Serial.println(kTensorArenaSize);

  /* El tensor de entrada puede venir como [1,125,3] o [1,125,3,1] segun como
     el conversor haya bajado el Conv1D. Da igual: se llena linealmente y lo
     unico que importa es que el total cuadre. */
  int total = 1;
  for (int i = 0; i < input->dims->size; i++) total *= input->dims->data[i];
  if (total != VENTANA * N_EJES) {
    Serial.print(F("Entrada del modelo = "));
    Serial.print(total);
    Serial.print(F(" pero la ventana es "));
    Serial.println(VENTANA * N_EJES);
    return false;
  }
  if (input->type != kTfLiteInt8 || output->type != kTfLiteInt8) {
    Serial.println(F("Se esperaba un modelo int8 en entrada y salida"));
    return false;
  }
  return true;
}

/* Numero de clases que declara el modelo, no el que asumimos. */
int nClases() {
  return output->dims->data[output->dims->size - 1];
}

/* ==========================================================================
 * Una inferencia sobre la ventana actual.
 * Escribe la etiqueta ganadora y su confianza en los parametros de salida.
 * ======================================================================= */
bool inferir(const char** etiqueta, float* confianza) {
  const float  inScale = input->params.scale;
  const int    inZero  = input->params.zero_point;

  /* La ventana es circular: la muestra mas antigua es la que sigue a la
     ultima escrita. Se recorre en orden cronologico. */
  int idx = 0;
  for (int k = 0; k < VENTANA; k++) {
    const int fila = (escritura + k) % VENTANA;
    for (int e = 0; e < N_EJES; e++) {
      const float z = (ventana[fila][e] - MEDIA[e]) / DESV[e];
      int q = (int)lroundf(z / inScale) + inZero;
      if (q < -128) q = -128;
      if (q >  127) q =  127;
      input->data.int8[idx++] = (int8_t)q;
    }
  }

  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println(F("Invoke fallo"));
    return false;
  }

  const float outScale = output->params.scale;
  const int   outZero  = output->params.zero_point;
  const int   n        = nClases();

  int   mejor = 0;
  float mejorP = -1.0f;
  for (int c = 0; c < n; c++) {
    const float p = (output->data.int8[c] - outZero) * outScale;
    if (p > mejorP) { mejorP = p; mejor = c; }
  }

  /* Si el modelo trae mas salidas que etiquetas en el header, no inventamos
     un nombre: se manda el indice. Asi se nota el desajuste en vez de mentir. */
  static char generica[16];
  if (mejor < N_CLASES_H) {
    *etiqueta = CLASES_C[mejor];
  } else {
    snprintf(generica, sizeof(generica), "clase_%d", mejor);
    *etiqueta = generica;
  }
  *confianza = mejorP;
  return true;
}

void setup() {
  Serial.begin(115200);
  // Sin espera de Serial a proposito: en la entrega la placa arranca con
  // power bank, sin PC. Un "while (!Serial)" la dejaria colgada.

  pinMode(LED_BUILTIN, OUTPUT);

  if (!IMU.begin()) {
    // Parpadeo rapido permanente = IMU no responde.
    while (true) { digitalWrite(LED_BUILTIN, HIGH); delay(80); digitalWrite(LED_BUILTIN, LOW); delay(80); }
  }

  modeloListo = iniciarModelo();
  if (!modeloListo) {
    // El sketch sigue vivo: sin modelo al menos el streaming funciona y la
    // app puede seguir grabando dataset.
    Serial.println(F("Sin modelo: arranco en modo streaming"));
    modo = MODO_STREAM;
  }

  if (!BLE.begin()) {
    while (true) { digitalWrite(LED_BUILTIN, HIGH); delay(400); digitalWrite(LED_BUILTIN, LOW); delay(400); }
  }

  BLE.setLocalName(NOMBRE_BLE);
  BLE.setDeviceName(NOMBRE_BLE);
  BLE.setAdvertisedService(servicio);
  servicio.addCharacteristic(txChar);
  servicio.addCharacteristic(rxChar);
  BLE.addService(servicio);
  BLE.advertise();

  Serial.print(F("BLE anunciando como ")); Serial.println(NOMBRE_BLE);
}

/* Reinicia la ventana: al cambiar de modo la cadencia cambia y mezclar
   muestras de 50 Hz con las de 62,5 Hz envenenaria la inferencia. */
void reiniciarVentana() {
  escritura = 0;
  llenas = 0;
  desdeUltima = 0;
}

void loop() {
  BLEDevice central = BLE.central();
  if (!central) { digitalWrite(LED_BUILTIN, LOW); return; }

  digitalWrite(LED_BUILTIN, HIGH);
  Serial.print(F("Conectado a ")); Serial.println(central.address());

  char linea[72];
  snprintf(linea, sizeof(linea), "H,nano33ble,%u\n",
           (unsigned)(modo == MODO_STREAM ? STREAM_HZ : 62));
  enviar(linea);

  const uint32_t t0 = millis();
  proximaMuestra = micros();
  reiniciarVentana();

  while (central.connected()) {

    /* --- ordenes desde la app --- */
    if (rxChar.written()) {
      const uint8_t* v = rxChar.value();
      if (rxChar.valueLength() > 0) {
        switch (v[0]) {
          case 'p': enviandoDatos = false; break;
          case 'r': enviandoDatos = true;  break;
          case 's': modo = MODO_STREAM; reiniciarVentana(); proximaMuestra = micros(); break;
          case 'i':
            if (modeloListo) { modo = MODO_INFERENCIA; reiniciarVentana(); proximaMuestra = micros(); }
            break;
        }
      }
    }

    /* --- muestreo de cadencia fija ---
       Comparacion con resta sin signo: sobrevive al desborde de micros()
       a los ~71 minutos. Un "micros() > proxima" se colgaria ahi. */
    if ((int32_t)(micros() - proximaMuestra) < 0) continue;
    proximaMuestra += (modo == MODO_STREAM) ? STREAM_US : INFER_US;

    if (!enviandoDatos) continue;

    /* ================================================================ */
    if (modo == MODO_STREAM) {
      float ax, ay, az, gx, gy, gz;
      if (!IMU.accelerationAvailable() || !IMU.gyroscopeAvailable()) continue;
      IMU.readAcceleration(ax, ay, az);   // g
      IMU.readGyroscope(gx, gy, gz);      // deg/s

      /* dtostrf en vez de %f: el printf de avr/mbed no trae coma flotante. */
      char sax[10], say[10], saz[10], sgx[10], sgy[10], sgz[10];
      dtostrf(ax, 0, 3, sax); dtostrf(ay, 0, 3, say); dtostrf(az, 0, 3, saz);
      dtostrf(gx, 0, 1, sgx); dtostrf(gy, 0, 1, sgy); dtostrf(gz, 0, 1, sgz);

      snprintf(linea, sizeof(linea), "D,%lu,%s,%s,%s,%s,%s,%s\n",
               (unsigned long)(millis() - t0), sax, say, saz, sgx, sgy, sgz);
      enviar(linea);
      continue;
    }

    /* ========================================================= inferencia */
    float ax, ay, az;
    if (IMU.accelerationAvailable()) {
      IMU.readAcceleration(ax, ay, az);          // g
      ultAx = ax; ultAy = ay; ultAz = az;
    } else {
      /* El LSM9DS1 va a 104 Hz, asi que pedirle 62,5 Hz casi nunca deja
         hueco. Si lo deja, se repite la ultima muestra: la ventana tiene que
         conservar la cadencia fija con la que se entreno. */
      ax = ultAx; ay = ultAy; az = ultAz;
    }

    ventana[escritura][0] = ax * G_A_MS2;
    ventana[escritura][1] = ay * G_A_MS2;
    ventana[escritura][2] = az * G_A_MS2;
    escritura = (escritura + 1) % VENTANA;
    if (llenas < VENTANA) llenas++;
    desdeUltima++;

    if (llenas < VENTANA || desdeUltima < PASO) continue;
    desdeUltima = 0;

    const char* etiqueta = nullptr;
    float conf = 0.0f;
    if (!inferir(&etiqueta, &conf)) continue;

    /* Formato sagrado: la app parsea esta linea tal cual. */
    char sconf[10];
    dtostrf(conf, 0, 2, sconf);
    snprintf(linea, sizeof(linea), "{\"g\":\"%s\",\"p\":%s}\n", etiqueta, sconf);
    enviar(linea);
  }

  digitalWrite(LED_BUILTIN, LOW);
  Serial.println(F("Desconectado"));
}
