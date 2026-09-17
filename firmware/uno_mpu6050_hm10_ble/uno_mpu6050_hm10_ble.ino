/* ============================================================================
 * MixLab — Arduino Uno + MPU6050 + HM-10: IMU -> BLE
 * Miniproyecto 1 TinyML · UAO 2026-2 · Grupo 2
 *
 * Camino alterno para quien solo tenga un Uno. Emite el mismo formato que la
 * webapp de app/ espera, asi que se conecta igual desde "Bluetooth LE".
 *
 * ⚠ POR QUE HM-10 Y NO HC-05
 *   HC-05 habla Bluetooth Classic (SPP). Los navegadores NO pueden abrir SPP:
 *   Web Bluetooth solo habla BLE. Con un HC-05 esta app no lo va a ver nunca.
 *   El HM-10 (o HM-19 / AT-09 / CC2541) si es BLE y expone un servicio serie.
 *
 * ⚠ EL UNO NO PUEDE CORRER EL MODELO
 *   El ATmega328P tiene 2 KB de RAM y sin FPU. Los modelos de Edge Impulse
 *   para IMU no caben. Con esta configuracion se captura el dataset; la
 *   inferencia a bordo necesita el Nano 33 BLE. Ver firmware/README.md.
 *
 * CONEXIONES
 *   MPU6050  VCC->5V   GND->GND   SDA->A4   SCL->A5
 *   HM-10    VCC->5V   GND->GND   TXD->D2 (RX del Uno)   RXD->D3 (TX del Uno)
 *
 *   ⚠ El RXD del HM-10 es de 3,3 V. Poner un divisor en D3:
 *     D3 --[1k]--+--[2k]-- GND        y del nodo + al RXD del HM-10.
 *     Sin divisor el modulo aguanta un rato y luego se degrada.
 *
 * VELOCIDAD
 *   El HM-10 sale de fabrica a 9600 bps: ~24 lineas/s como techo absoluto.
 *   Este sketch asume 38400, que ya permite 40 Hz. Para dejarlo asi, una vez,
 *   con el modulo conectado y el monitor serie a 9600:
 *       AT+BAUD2        -> responde OK+Set:2   (2 = 38400)
 *   Si no quieres tocarlo, pon HM10_BAUD 9600 y SAMPLE_HZ 20.
 * ========================================================================= */

#include <Wire.h>
#include <SoftwareSerial.h>

/* ---------------------------------------------------------------- ajustes */
static const uint8_t  PIN_RX     = 2;      // va al TXD del HM-10
static const uint8_t  PIN_TX     = 3;      // va al RXD del HM-10 (con divisor)
static const long     HM10_BAUD  = 38400;
static const uint8_t  SAMPLE_HZ  = 40;
static const uint16_t PERIODO_MS = 1000 / SAMPLE_HZ;

/* ------------------------------------------------------------- MPU6050 */
static const uint8_t MPU_ADDR     = 0x68;
static const uint8_t REG_PWR_MGMT = 0x6B;
static const uint8_t REG_GYRO_CFG = 0x1B;
static const uint8_t REG_ACC_CFG  = 0x1C;
static const uint8_t REG_ACC_XOUT = 0x3B;
static const uint8_t REG_WHO_AM_I = 0x75;

/* Rangos amplios a proposito: agitar una coctelera pasa de 2 g y de
   250 deg/s sin esfuerzo, y una muestra saturada no se puede recuperar.
   ±8 g  -> 4096 LSB/g        ±1000 deg/s -> 32,8 LSB/(deg/s) */
static const uint8_t ACC_CFG_8G    = 0x10;
static const uint8_t GYRO_CFG_1000 = 0x10;
static const float   ACC_LSB_POR_G = 4096.0f;
static const float   GYR_LSB_POR_DPS = 32.8f;

SoftwareSerial ble(PIN_RX, PIN_TX);

uint32_t t0 = 0;
uint32_t proxima = 0;

/* -------------------------------------------------------------- helpers */
void escribirReg(uint8_t reg, uint8_t valor) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(valor);
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
  ble.begin(HM10_BAUD);
  Wire.begin();
  Wire.setClock(400000);          // I2C rapido: a 100 kHz la lectura come 1,4 ms

  pinMode(LED_BUILTIN, OUTPUT);

  uint8_t quien = leerReg(REG_WHO_AM_I);
  if (quien != 0x68 && quien != 0x70 && quien != 0x72) {
    Serial.print(F("MPU6050 no responde. WHO_AM_I=0x")); Serial.println(quien, HEX);
    Serial.println(F("Revisa SDA=A4, SCL=A5 y la alimentacion."));
    while (true) { digitalWrite(LED_BUILTIN, HIGH); delay(80); digitalWrite(LED_BUILTIN, LOW); delay(80); }
  }

  escribirReg(REG_PWR_MGMT, 0x00);        // despertar
  delay(50);
  escribirReg(REG_ACC_CFG,  ACC_CFG_8G);
  escribirReg(REG_GYRO_CFG, GYRO_CFG_1000);
  delay(20);

  t0 = millis();
  proxima = t0;

  char hola[32];
  snprintf(hola, sizeof(hola), "H,uno-mpu6050,%u\n", SAMPLE_HZ);
  ble.print(hola);
  Serial.print(hola);
}

void loop() {
  /* Cadencia fija con resta sin signo: aguanta el desborde de millis(). */
  if ((int32_t)(millis() - proxima) < 0) return;
  proxima += PERIODO_MS;

  /* --- lectura de golpe: 14 bytes, acelerometro + temp + giroscopio --- */
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_ACC_XOUT);
  if (Wire.endTransmission(false) != 0) return;

  if (Wire.requestFrom(MPU_ADDR, (uint8_t)14) != 14) return;

  int16_t axr = (Wire.read() << 8) | Wire.read();
  int16_t ayr = (Wire.read() << 8) | Wire.read();
  int16_t azr = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();                  // temperatura: no se usa
  int16_t gxr = (Wire.read() << 8) | Wire.read();
  int16_t gyr = (Wire.read() << 8) | Wire.read();
  int16_t gzr = (Wire.read() << 8) | Wire.read();

  float ax = axr / ACC_LSB_POR_G;
  float ay = ayr / ACC_LSB_POR_G;
  float az = azr / ACC_LSB_POR_G;
  float gx = gxr / GYR_LSB_POR_DPS;
  float gy = gyr / GYR_LSB_POR_DPS;
  float gz = gzr / GYR_LSB_POR_DPS;

  /* El printf de AVR no imprime float: hay que pasar por dtostrf. */
  char sax[9], say[9], saz[9], sgx[9], sgy[9], sgz[9];
  dtostrf(ax, 0, 3, sax); dtostrf(ay, 0, 3, say); dtostrf(az, 0, 3, saz);
  dtostrf(gx, 0, 1, sgx); dtostrf(gy, 0, 1, sgy); dtostrf(gz, 0, 1, sgz);

  char linea[72];
  snprintf(linea, sizeof(linea), "D,%lu,%s,%s,%s,%s,%s,%s\n",
           (unsigned long)(millis() - t0), sax, say, saz, sgx, sgy, sgz);

  ble.print(linea);

  /* Latido cada segundo: confirma que el bucle vive sin gastar el serial. */
  digitalWrite(LED_BUILTIN, ((millis() - t0) / 500) % 2);
}
