/* ============================================================================
 * MixLab — Arduino Uno R4 WiFi + MPU6050: IMU -> WebSocket
 * Miniproyecto 1 TinyML · UAO 2026-2 · Grupo 2
 *
 * Levanta un servidor WebSocket en el puerto 81 y emite el formato que espera
 * la webapp de app/. Desde la pestana "WiFi" se conecta con:
 *     ws://<ip-que-imprime-el-serial>:81
 *
 * SIN LIBRERIAS EXTERNAS
 *   El apreton de manos de WebSocket necesita SHA-1 y Base64; van escritos
 *   abajo. SHA-1 y Base64 estan verificados contra los vectores de RFC 3174
 *   y contra el ejemplo del RFC 6455 ("dGhlIHNhbXBsZSBub25jZQ==" ->
 *   "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=").
 *
 * ⚠ EL UNO R4 NO TRAE IMU. Hay que ponerle un MPU6050 aparte.
 *   MPU6050  VCC->5V   GND->GND   SDA->SDA (o A4)   SCL->SCL (o A5)
 *
 * ⚠ CONTEXTO SEGURO EN EL NAVEGADOR
 *   Una pagina servida por HTTPS no puede abrir un "ws://" sin cifrar. Si vas
 *   a usar este camino, sirve la webapp por HTTP en la red local
 *   (python3 -m http.server dentro de app/). La app avisa de esto sola.
 *
 * ⚠ EL R4 TAMPOCO CORRE EL MODELO COMODAMENTE
 *   Para la inferencia a bordo el proyecto usa el Nano 33 BLE. Este sketch
 *   sirve para capturar dataset por WiFi. Ver firmware/README.md.
 * ========================================================================= */

#include <WiFiS3.h>
#include <Wire.h>

/* ---------------------------------------------------------------- ajustes */
const char* WIFI_SSID  = "TU_RED";
const char* WIFI_PASS  = "TU_CLAVE";

static const uint16_t PUERTO     = 81;
static const uint8_t  SAMPLE_HZ  = 100;      // por WiFi el ancho de banda no aprieta
static const uint16_t PERIODO_MS = 1000 / SAMPLE_HZ;

WiFiServer server(PUERTO);
WiFiClient cliente;
bool handshakeListo = false;

/* ------------------------------------------------------------- MPU6050 */
static const uint8_t MPU_ADDR     = 0x68;
static const uint8_t REG_PWR_MGMT = 0x6B;
static const uint8_t REG_GYRO_CFG = 0x1B;
static const uint8_t REG_ACC_CFG  = 0x1C;
static const uint8_t REG_ACC_XOUT = 0x3B;
static const uint8_t REG_WHO_AM_I = 0x75;

static const float ACC_LSB_POR_G     = 4096.0f;   // ±8 g
static const float GYR_LSB_POR_DPS   = 32.8f;     // ±1000 deg/s

uint32_t t0 = 0, proxima = 0;

/* ==========================================================================
 * SHA-1 de un solo golpe (entradas cortas: <= 119 bytes)
 * ======================================================================= */
static void sha1(const uint8_t* msg, size_t len, uint8_t out[20]) {
  uint8_t block[128];
  memset(block, 0, sizeof(block));
  memcpy(block, msg, len);
  block[len] = 0x80;
  size_t total = ((len + 9 + 63) / 64) * 64;      // 64 o 128 bytes
  uint64_t bits = (uint64_t)len * 8;
  for (int i = 0; i < 8; i++) block[total - 1 - i] = (uint8_t)(bits >> (8 * i));

  uint32_t h[5] = {0x67452301u, 0xEFCDAB89u, 0x98BADCFEu, 0x10325476u, 0xC3D2E1F0u};

  for (size_t off = 0; off < total; off += 64) {
    uint32_t w[80];
    for (int i = 0; i < 16; i++)
      w[i] = ((uint32_t)block[off + 4*i] << 24) | ((uint32_t)block[off + 4*i + 1] << 16)
           | ((uint32_t)block[off + 4*i + 2] << 8) | block[off + 4*i + 3];
    for (int i = 16; i < 80; i++) {
      uint32_t v = w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16];
      w[i] = (v << 1) | (v >> 31);
    }
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (int i = 0; i < 80; i++) {
      uint32_t f, k;
      if      (i < 20) { f = (b & c) | ((~b) & d);          k = 0x5A827999u; }
      else if (i < 40) { f = b ^ c ^ d;                     k = 0x6ED9EBA1u; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d);   k = 0x8F1BBCDCu; }
      else             { f = b ^ c ^ d;                     k = 0xCA62C1D6u; }
      uint32_t t = ((a << 5) | (a >> 27)) + f + e + k + w[i];
      e = d; d = c; c = (b << 30) | (b >> 2); b = a; a = t;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
  }
  for (int i = 0; i < 5; i++) {
    out[4*i] = h[i] >> 24; out[4*i+1] = h[i] >> 16; out[4*i+2] = h[i] >> 8; out[4*i+3] = h[i];
  }
}

static const char B64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void base64(const uint8_t* in, size_t n, char* out) {
  size_t i = 0, o = 0;
  while (i < n) {
    uint32_t v = (uint32_t)in[i++] << 16;
    int r = 1;
    if (i < n) { v |= (uint32_t)in[i++] << 8; r++; }
    if (i < n) { v |= in[i++];                r++; }
    out[o++] = B64[(v >> 18) & 63];
    out[o++] = B64[(v >> 12) & 63];
    out[o++] = r > 1 ? B64[(v >> 6) & 63] : '=';
    out[o++] = r > 2 ? B64[v & 63]        : '=';
  }
  out[o] = 0;
}

/* ==========================================================================
 * WebSocket: apreton de manos y envio de tramas de texto
 * ======================================================================= */
static const char* GUID_WS = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

bool hacerHandshake(WiFiClient& c) {
  char clave[32] = {0};
  bool esUpgrade = false;
  uint32_t limite = millis() + 3000;

  /* Leer cabeceras hasta la linea vacia. Con tope de tiempo: un escaner de
     puertos que abre y calla dejaria el bucle colgado para siempre. */
  while (c.connected() && millis() < limite) {
    String linea = c.readStringUntil('\n');
    linea.trim();
    if (linea.length() == 0) break;

    if (linea.startsWith("Sec-WebSocket-Key:")) {
      String v = linea.substring(18);
      v.trim();
      v.toCharArray(clave, sizeof(clave));
    } else if (linea.indexOf("Upgrade") >= 0 && linea.indexOf("websocket") >= 0) {
      esUpgrade = true;
    }
  }

  if (!clave[0]) {
    // No es WebSocket: probablemente un navegador entrando por http://ip:81
    c.print(F("HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n"
              "Este puerto habla WebSocket. Conecta desde la app con ws://<ip>:81\n"));
    return false;
  }
  (void)esUpgrade;   // la clave ya es senal suficiente

  char cat[96];
  snprintf(cat, sizeof(cat), "%s%s", clave, GUID_WS);

  uint8_t hash[20];
  sha1((const uint8_t*)cat, strlen(cat), hash);

  char accept[32];
  base64(hash, 20, accept);

  c.print(F("HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: "));
  c.print(accept);
  c.print(F("\r\n\r\n"));
  return true;
}

/* Trama de texto, FIN=1, opcode=0x1. El servidor nunca enmascara. */
void wsEnviarTexto(WiFiClient& c, const char* s) {
  size_t n = strlen(s);
  uint8_t cab[4];
  size_t cn;

  if (n < 126) {
    cab[0] = 0x81; cab[1] = (uint8_t)n; cn = 2;
  } else {
    cab[0] = 0x81; cab[1] = 126;
    cab[2] = (uint8_t)(n >> 8); cab[3] = (uint8_t)(n & 0xFF); cn = 4;
  }
  c.write(cab, cn);
  c.write((const uint8_t*)s, n);
}

/* Vaciar lo que manda el navegador (ping, close). Si no se lee, el buffer
   de recepcion se llena y la conexion se atasca sin dar error. */
void wsDrenar(WiFiClient& c) {
  while (c.available()) {
    int b = c.read();
    if (b < 0) break;
    if ((b & 0x0F) == 0x8) {          // opcode de cierre
      c.stop();
      handshakeListo = false;
      return;
    }
  }
}

/* ==========================================================================
 * MPU6050
 * ======================================================================= */
void escribirReg(uint8_t reg, uint8_t valor) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg); Wire.write(valor);
  Wire.endTransmission();
}

uint8_t leerReg(uint8_t reg) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0xFF;
}

void setup() {
  Serial.begin(115200);
  // Sin "while (!Serial)": la placa tiene que arrancar sola con power bank.

  Wire.begin();
  Wire.setClock(400000);

  uint8_t quien = leerReg(REG_WHO_AM_I);
  if (quien != 0x68 && quien != 0x70 && quien != 0x72) {
    Serial.print(F("MPU6050 no responde. WHO_AM_I=0x")); Serial.println(quien, HEX);
  } else {
    escribirReg(REG_PWR_MGMT, 0x00); delay(50);
    escribirReg(REG_ACC_CFG,  0x10);      // ±8 g
    escribirReg(REG_GYRO_CFG, 0x10);      // ±1000 deg/s
    delay(20);
  }

  Serial.print(F("Conectando a ")); Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  uint8_t intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos++ < 40) {
    delay(500); Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("No entro a la red. Revisa SSID y clave."));
  } else {
    server.begin();
    Serial.print(F("Listo. En la app pon:  ws://"));
    Serial.print(WiFi.localIP());
    Serial.print(':'); Serial.println(PUERTO);
  }

  t0 = millis();
  proxima = t0;
}

void loop() {
  /* --- gestion del cliente --- */
  if (!cliente || !cliente.connected()) {
    handshakeListo = false;
    WiFiClient nuevo = server.available();
    if (nuevo) {
      cliente = nuevo;
      handshakeListo = hacerHandshake(cliente);
      if (handshakeListo) {
        char hola[40];
        snprintf(hola, sizeof(hola), "H,uno-r4-wifi,%u\n", SAMPLE_HZ);
        wsEnviarTexto(cliente, hola);
        Serial.println(F("Cliente WebSocket conectado"));
      } else {
        cliente.stop();
      }
    }
    return;
  }

  wsDrenar(cliente);
  if (!handshakeListo) return;

  /* --- cadencia fija; resta sin signo para sobrevivir al desborde --- */
  if ((int32_t)(millis() - proxima) < 0) return;
  proxima += PERIODO_MS;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_ACC_XOUT);
  if (Wire.endTransmission(false) != 0) return;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)14) != 14) return;

  int16_t axr = (Wire.read() << 8) | Wire.read();
  int16_t ayr = (Wire.read() << 8) | Wire.read();
  int16_t azr = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();                    // temperatura
  int16_t gxr = (Wire.read() << 8) | Wire.read();
  int16_t gyr = (Wire.read() << 8) | Wire.read();
  int16_t gzr = (Wire.read() << 8) | Wire.read();

  char sax[10], say[10], saz[10], sgx[10], sgy[10], sgz[10];
  dtostrf(axr / ACC_LSB_POR_G,   0, 3, sax);
  dtostrf(ayr / ACC_LSB_POR_G,   0, 3, say);
  dtostrf(azr / ACC_LSB_POR_G,   0, 3, saz);
  dtostrf(gxr / GYR_LSB_POR_DPS, 0, 1, sgx);
  dtostrf(gyr / GYR_LSB_POR_DPS, 0, 1, sgy);
  dtostrf(gzr / GYR_LSB_POR_DPS, 0, 1, sgz);

  char linea[80];
  snprintf(linea, sizeof(linea), "D,%lu,%s,%s,%s,%s,%s,%s\n",
           (unsigned long)(millis() - t0), sax, say, saz, sgx, sgy, sgz);

  wsEnviarTexto(cliente, linea);
}
