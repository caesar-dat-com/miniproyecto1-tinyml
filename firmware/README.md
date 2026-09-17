# Firmware

Tres sketches. Los tres hablan **el mismo protocolo de línea**, así que la app de
[`app/`](../app/) los acepta sin cambiar nada.

| Carpeta | Placa | Transporte | Sirve para |
|---|---|---|---|
| [`nano33ble_imu_ble/`](nano33ble_imu_ble/) | Nano 33 BLE / Rev2 | BLE | **El camino del proyecto**: captura + inferencia a bordo |
| [`uno_mpu6050_hm10_ble/`](uno_mpu6050_hm10_ble/) | Uno + MPU6050 + HM-10 | BLE | Capturar dataset si solo hay un Uno |
| [`uno_r4_wifi_imu/`](uno_r4_wifi_imu/) | Uno R4 WiFi + MPU6050 | WebSocket | Capturar dataset por WiFi |

## Protocolo

Una línea de texto por evento, terminada en `\n`:

```text
D,<t_ms>,<ax>,<ay>,<az>,<gx>,<gy>,<gz>    muestra del IMU
I,<clase>,<confianza>                     resultado de inferencia (0..1)
H,<placa>,<hz>                            saludo al conectar (opcional)
```

Aceleración en **g**, giro en **°/s**. El parser también acepta seis números
sueltos sin el prefijo `D`, y JSON — pero los sketches emiten la forma de arriba.

## Qué placa hace qué

**El Arduino Uno clásico (R3) no puede ser el corazón de este proyecto.** No por
capricho: el ATmega328P tiene 2 KB de RAM y no tiene unidad de coma flotante, así
que un clasificador de Edge Impulse sobre ventanas de IMU no le cabe. El Uno
sirve para **capturar el dataset**; la inferencia a bordo necesita el
**Nano 33 BLE**, que además ya trae el IMU dentro.

El **Uno R4 WiFi** tiene más músculo (Renesas RA4M1, 32 KB de RAM) pero **tampoco
trae IMU**: hay que colgarle un MPU6050 igual que al R3.

| | IMU integrado | BLE | WiFi | ¿Corre el modelo? |
|---|:-:|:-:|:-:|:-:|
| Uno R3 | ❌ | ❌ | ❌ | ❌ |
| Uno R4 WiFi | ❌ | ❌ | ✅ | ⚠️ justo |
| **Nano 33 BLE / Rev2** | ✅ | ✅ | ❌ | ✅ |

## HC-05 no funciona con esta app

Es la trampa más común del camino BLE. El **HC-05** y el **HC-06** hablan
Bluetooth Classic (perfil SPP), y **ningún navegador puede abrir SPP**:
Web Bluetooth solo habla BLE. Con un HC-05 la app no va a ver el módulo nunca,
por más que el emparejamiento del sistema operativo diga que está listo.

Módulos que sí valen: **HM-10**, HM-19, AT-09, CC2541 — todos BLE.

## Librerías

Del Gestor de librerías del IDE de Arduino:

| Sketch | Librerías |
|---|---|
| `nano33ble_imu_ble` | `ArduinoBLE` + (`Arduino_LSM9DS1` **o** `Arduino_BMI270_BMM150`) |
| `uno_mpu6050_hm10_ble` | ninguna (`Wire` y `SoftwareSerial` vienen con el IDE) |
| `uno_r4_wifi_imu` | ninguna (`WiFiS3` viene con el core del R4) |

El MPU6050 se maneja por registros directos a propósito: una dependencia menos
que instalar el día de la sustentación.

El apretón de manos de WebSocket del sketch del R4 lleva **SHA-1 y Base64
escritos a mano**, verificados contra los vectores de RFC 3174 y contra el
ejemplo del RFC 6455 (`dGhlIHNhbXBsZSBub25jZQ==` → `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`).

## Cuál elegir según el IMU del Nano

El Nano 33 BLE cambió de sensor entre revisiones y **la librería no es la misma**:

```cpp
#define IMU_LSM9DS1     // Nano 33 BLE y BLE Sense  (las primeras)
// #define IMU_BMI270   // Nano 33 BLE Rev2 / Sense Rev2
```

Si el sketch compila pero `IMU.begin()` falla y el LED parpadea rápido, casi
siempre es este `#define` al revés.

## Ancho de banda del BLE

Con el MTU por defecto una notificación BLE lleva **20 bytes útiles**, y una
muestra ocupa unos 40 caracteres: dos notificaciones por muestra. Por eso el
sketch del Nano streamea a **50 Hz** y el del Uno+HM-10 a **40 Hz** (y el HM-10
necesita `AT+BAUD2` para pasar de 9600 a 38400 — a 9600 el techo son ~24
líneas/s).

Para la **demo de inferencia** esto deja de importar: solo viajan líneas `I,`,
una por segundo.

## Poner el modelo de Edge Impulse

En `nano33ble_imu_ble.ino` está marcado el punto exacto donde entra. Con el
modelo exportado como *Arduino library*:

```cpp
#include <MixLab_inferencing.h>
// acumular EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE valores,
// llamar run_classifier(), quedarse con la etiqueta de mayor valor y emitir:
snprintf(linea, sizeof(linea), "I,%s,%s\n", etiqueta, sconf);
enviar(linea);
```

Mientras no haya modelo la app funciona igual: las gráficas y el grabador solo
necesitan las líneas `D,`.

## Recordatorio de la entrega

`docs/requisitos.md` exige que **la placa no esté conectada al PC**, ni por datos
ni por energía. El camino Serial USB de la app es solo para desarrollar y
calibrar; la demo va con batería y BLE (o WiFi).
