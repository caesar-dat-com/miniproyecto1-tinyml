/* ============================================================================
 * MixLab — Nano 33 BLE: IMU -> BLE (servicio UART de Nordic)
 * Miniproyecto 1 TinyML · UAO 2026-2 · Grupo 2
 *
 * Emite el formato que espera la webapp de app/:
 *   D,<t_ms>,<ax>,<ay>,<az>,<gx>,<gy>,<gz>     (aceleracion en g, giro en deg/s)
 *   I,<clase>,<confianza>                      (cuando hay modelo compilado)
 *   H,<placa>,<hz>                             (saludo al conectar)
 *
 * PLACAS
 *   Nano 33 BLE / BLE Sense  -> IMU LSM9DS1  (libreria Arduino_LSM9DS1)
 *   Nano 33 BLE Rev2 / Sense Rev2 -> IMU BMI270+BMM150 (Arduino_BMI270_BMM150)
 *   Descomenta el #define que corresponda.
 *
 * LIBRERIAS (Gestor de librerias del IDE)
 *   ArduinoBLE
 *   Arduino_LSM9DS1   o   Arduino_BMI270_BMM150
 *
 * NOTA DE ANCHO DE BANDA
 *   Una notificacion BLE lleva 20 bytes utiles con el MTU por defecto, y
 *   cada muestra ocupa ~40 caracteres: son 2 notificaciones por muestra.
 *   Por eso el streaming va a 50 Hz. Para la demo de inferencia solo viajan
 *   lineas "I," (una por segundo) y el ancho de banda deja de importar.
 * ========================================================================= */

#include <ArduinoBLE.h>

#define IMU_LSM9DS1
// #define IMU_BMI270

#ifdef IMU_LSM9DS1
  #include <Arduino_LSM9DS1.h>
#else
  #include <Arduino_BMI270_BMM150.h>
#endif

/* ---------------------------------------------------------------- ajustes */
static const char*    NOMBRE_BLE  = "MixLab-Coctelera";
static const uint16_t SAMPLE_HZ   = 50;                    // streaming de datos
static const uint32_t PERIODO_US  = 1000000UL / SAMPLE_HZ;

/* Servicio UART de Nordic: el de facto para "serie sobre BLE". */
static const char* UUID_SERVICIO = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* UUID_TX       = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // placa -> app
static const char* UUID_RX       = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // app -> placa

BLEService            servicio(UUID_SERVICIO);
BLECharacteristic     txChar(UUID_TX, BLENotify, 20);
BLECharacteristic     rxChar(UUID_RX, BLEWrite,  20);

/* ------------------------------------------------------------------ estado */
bool     enviandoDatos = true;   // la app puede pedir pausa escribiendo en RX
uint32_t proximaMuestra = 0;

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

void setup() {
  Serial.begin(115200);
  // Sin espera de Serial a proposito: en la entrega la placa arranca con
  // power bank, sin PC. Un "while (!Serial)" la dejaria colgada.

  pinMode(LED_BUILTIN, OUTPUT);

  if (!IMU.begin()) {
    // Parpadeo rapido permanente = IMU no responde.
    while (true) { digitalWrite(LED_BUILTIN, HIGH); delay(80); digitalWrite(LED_BUILTIN, LOW); delay(80); }
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

void loop() {
  BLEDevice central = BLE.central();
  if (!central) { digitalWrite(LED_BUILTIN, LOW); return; }

  digitalWrite(LED_BUILTIN, HIGH);
  Serial.print(F("Conectado a ")); Serial.println(central.address());

  char linea[72];
  snprintf(linea, sizeof(linea), "H,nano33ble,%u\n", SAMPLE_HZ);
  enviar(linea);

  const uint32_t t0 = millis();
  proximaMuestra = micros();

  while (central.connected()) {

    /* --- ordenes desde la app: 'p' pausa, 'r' reanuda --- */
    if (rxChar.written()) {
      const uint8_t* v = rxChar.value();
      if (rxChar.valueLength() > 0) {
        if (v[0] == 'p') enviandoDatos = false;
        if (v[0] == 'r') enviandoDatos = true;
      }
    }

    /* --- muestreo de cadencia fija ---
       Comparacion con resta sin signo: sobrevive al desborde de micros()
       a los ~71 minutos. Un "micros() > proxima" se colgaria ahi. */
    if ((int32_t)(micros() - proximaMuestra) < 0) continue;
    proximaMuestra += PERIODO_US;

    if (!enviandoDatos) continue;

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

    /* ======================================================================
     * AQUI VA LA INFERENCIA
     * Con el modelo de Edge Impulse exportado como libreria Arduino:
     *
     *   #include <MixLab_inferencing.h>
     *   // acumular en un buffer de EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE,
     *   // llamar run_classifier() y quedarse con la etiqueta de mayor valor:
     *   //
     *   //   snprintf(linea, sizeof(linea), "I,%s,%s\n", etiqueta, sconf);
     *   //   enviar(linea);
     *
     * Mientras no haya modelo, la app funciona igual: las graficas y el
     * grabador solo necesitan las lineas "D,".
     * =================================================================== */
  }

  digitalWrite(LED_BUILTIN, LOW);
  Serial.println(F("Desconectado"));
}
