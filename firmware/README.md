# Firmware

Cuatro sketches. Todos hablan **el mismo protocolo de línea**, así que la app de
[`app/`](../app/) los acepta sin cambiar nada.

| Carpeta | Placa | Transporte | Sirve para |
|---|---|---|---|
| [`nano33ble_mixlab_inferencia/`](nano33ble_mixlab_inferencia/) | Nano 33 BLE / Rev2 | BLE | **El de la demo**: inferencia a bordo + streaming crudo |
| [`nano33ble_imu_ble/`](nano33ble_imu_ble/) | Nano 33 BLE / Rev2 | BLE | Solo captura: el que se usó para grabar el dataset |
| [`uno_mpu6050_hm10_ble/`](uno_mpu6050_hm10_ble/) | Uno + MPU6050 + HM-10 | BLE | Capturar dataset si solo hay un Uno |
| [`uno_r4_wifi_imu/`](uno_r4_wifi_imu/) | Uno R4 WiFi + MPU6050 | WebSocket | Capturar dataset por WiFi |

## Protocolo

Una línea de texto por evento, terminada en `\n`:

```text
D,<t_ms>,<ax>,<ay>,<az>,<gx>,<gy>,<gz>    muestra del IMU
{"g":"agitar","p":0.87}                   resultado de inferencia
I,<clase>,<confianza>                     misma cosa, forma larga (simulador)
H,<placa>,<hz>                            saludo al conectar
```

Aceleración en **g**, giro en **°/s**.

El sketch de inferencia emite la forma **JSON corta** a propósito: con el MTU por
defecto una notificación BLE lleva 20 bytes útiles, y `{"g":"agitar","p":0.87}`
cabe en dos notificaciones. `app/js/protocol.js` acepta las dos formas, así que
el simulador (que usa `I,`) sigue funcionando igual.

## El sketch de la demo: `nano33ble_mixlab_inferencia`

### Qué hace

Dos modos, que la app elige escribiendo un byte en la característica RX:

| Comando | Efecto |
|---|---|
| `i` | modo **inferencia** (por defecto) |
| `s` | modo **streaming** crudo a 50 Hz |
| `p` | pausa el envío |
| `r` | reanuda el envío |

Los dos primeros están cableados a los botones **Modo inferencia** / **Modo
señal cruda** del panel de inferencia del Taller. Hasta ahora la app declaraba
el UUID de RX pero nunca escribía en él; se le añadió un `send()` al transporte
BLE (`app/js/transports.js`) para poder mandar estos bytes.

En **inferencia** muestrea el acelerómetro cada **16,0 ms (62,5 Hz)** — el
intervalo exacto con el que se capturó el dataset —, llena una ventana de
**125 muestras × 3 ejes** con **paso 25** (solapamiento de 100 muestras),
normaliza y corre el Conv1D int8. Sale una línea JSON cada 25 muestras, o sea
**2,5 inferencias por segundo**.

En **streaming** emite las líneas `D,` de siempre a 50 Hz, que es lo que usa el
Taller de la app para ver la señal viva y para grabar dataset.

> El sketch **reinicia la ventana** al cambiar de modo. Mezclar muestras de
> 50 Hz con las de 62,5 Hz en la misma ventana envenena la inferencia.

### Nombre BLE

Se anuncia como **`MixLab`**. Es el nombre que hay que buscar al escanear.

### UUIDs (servicio UART de Nordic)

No se tocan: son los que la app ya escucha.

| Qué | UUID |
|---|---|
| Servicio | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| TX (placa → app, notify) | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |
| RX (app → placa, write) | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |

## Librerías

| Sketch | Librerías |
|---|---|
| `nano33ble_mixlab_inferencia` | `ArduinoBLE` + `Arduino_LSM9DS1` (o `Arduino_BMI270_BMM150`) + **`Chirale_TensorFLowLite`** |
| `nano33ble_imu_ble` | `ArduinoBLE` + (`Arduino_LSM9DS1` **o** `Arduino_BMI270_BMM150`) |
| `uno_mpu6050_hm10_ble` | ninguna (`Wire` y `SoftwareSerial` vienen con el IDE) |
| `uno_r4_wifi_imu` | ninguna (`WiFiS3` viene con el core del R4) |

### Cuál librería de TensorFlow, y por qué no la que dice todo el mundo

La que sale en casi todos los tutoriales, **`Arduino_TensorFlowLite`** (la de
Sandeep Mistry), **ya no está en el gestor de librerías**:

```console
$ arduino-cli lib install Arduino_TensorFlowLite
Error installing Arduino_TensorFlowLite: Library 'Arduino_TensorFlowLite@latest' not found
```

`Arduino_TensorFlowLite_ESP32` tampoco sirve: es para ESP32, no para mbed_nano.

La que se usa aquí es **`Chirale_TensorFLowLite`** (ojo a la `L` mayúscula en
`FLowLite`, el nombre está así en el índice). Es la misma TensorFlow Lite Micro
empaquetada para Arduino, y declara `mbed_nano` entre sus arquitecturas:

```bash
arduino-cli lib install Chirale_TensorFLowLite
```

Su API es la de TFLM de toda la vida (`tflite::MicroInterpreter`,
`AllOpsResolver`), que es lo que el sketch necesita para leer los parámetros de
cuantización del modelo. La hermana `ArduTFLite` es un envoltorio más simple,
pero esconde justo esos parámetros.

## Instalar el core y las librerías

El core ya está instalado en esta máquina, pero por si hay que rehacerlo:

```bash
arduino-cli core update-index
arduino-cli core install arduino:mbed_nano

arduino-cli lib install ArduinoBLE
arduino-cli lib install Arduino_LSM9DS1
arduino-cli lib install Chirale_TensorFLowLite
```

## Compilar y subir

### Con `arduino-cli`

```bash
# compilar (desde la raíz del repo)
arduino-cli compile -b arduino:mbed_nano:nano33ble firmware/nano33ble_mixlab_inferencia

# ver en qué puerto está la placa
arduino-cli board list

# subir (cambia /dev/ttyACM0 por el que salga arriba)
arduino-cli upload -b arduino:mbed_nano:nano33ble -p /dev/ttyACM0 firmware/nano33ble_mixlab_inferencia
```

La primera compilación tarda **varios minutos**: TFLM son cientos de archivos.
Las siguientes van con caché y bajan a segundos.

> Si la subida falla con un error de puerto, da **doble toque al botón de reset**
> de la placa: entra en modo bootloader y aparece un puerto nuevo.

### Con el IDE de Arduino

1. **Herramientas → Placa → Arduino Mbed OS Nano Boards → Arduino Nano 33 BLE**
2. **Herramientas → Puerto** → el que corresponda
3. Instala las tres librerías desde **Herramientas → Gestor de librerías**
4. Abre `firmware/nano33ble_mixlab_inferencia/nano33ble_mixlab_inferencia.ino`
   (el `.h` del modelo se abre solo en otra pestaña, tiene que estar en la misma
   carpeta que el `.ino`)
5. **Subir**

### Si la placa es una Rev2

El Nano 33 BLE cambió de sensor entre revisiones y **la librería no es la misma**:

```cpp
#define USAR_LSM9DS1     // Nano 33 BLE y BLE Sense  (las primeras)
// #define USAR_BMI270   // Nano 33 BLE Rev2 / Sense Rev2
```

Si el sketch compila pero `IMU.begin()` falla y el LED parpadea rápido, casi
siempre es este `#define` al revés.

> El define se llama `USAR_*` y no `IMU_*` por una razón muy concreta:
> `Arduino_LSM9DS1` hace internamente `#define IMU IMU_LSM9DS1`. Un define
> propio llamado `IMU_LSM9DS1` deja el objeto `IMU` convertido en nada y el
> sketch no compila (`expected primary-expression before '.' token`).

## Las constantes de normalización

**Están todas en `nano33ble_mixlab_inferencia/modelo_via_b.h`**, que es una copia
literal de `notebooks/via_b_int8.h`, el archivo que escribe el notebook
`03_entrenamiento_B_conv1d.ipynb`. En el `.ino` **no hay ni una constante
escrita a mano**.

El `.h` trae:

```cpp
const unsigned char modelo_via_b[];              // el .tflite int8
const unsigned int  modelo_via_b_len;
const float MEDIA[3];                            // media del StandardScaler, por eje
const float DESV[3];                             // desviación estándar, por eje
const int   VENTANA;                             // 125 muestras
const int   N_EJES;                              // 3
const char* CLASES_C[];                          // etiquetas en el orden del modelo
```

### Cómo rellenarlas después de un reentreno

No se editan a mano. Se corre el script:

```bash
./firmware/tools/sync_modelo.sh
```

Copia `notebooks/via_b_int8.h` encima de `modelo_via_b.h`, verifica que no falte
ninguno de los siete símbolos y te imprime los valores que va a usar el
firmware. Después, recompilar. Si el notebook no ha emitido algún símbolo, el
script falla diciendo cuál — mejor eso que cien líneas de plantillas del
compilador.

### El detalle de las unidades (importa)

Los `.cbor` de Edge Impulse declaran `units: "m/s2"`, y la media del eje Y
(`-6.03`) solo tiene sentido en m/s²: en g sería absurda. Pero
`IMU.readAcceleration()` de Arduino devuelve **g**. Por eso el sketch multiplica
por `G_A_MS2 = 9.80665f` antes de normalizar:

```cpp
ventana[escritura][0] = ax * G_A_MS2;
```

**Si algún día se reentrena con los datos en g, hay que poner `G_A_MS2 = 1.0f`.**
Sin ese factor la señal entra ~9,8 veces más pequeña de lo que el modelo espera
y las predicciones salen a la basura, sin ningún error visible.

### El tamaño del arena

```cpp
constexpr int kTensorArenaSize = 24 * 1024;
```

Si tras un reentreno el modelo crece y `AllocateTensors()` falla, el sketch lo
dice por Serial (`AllocateTensors fallo: sube kTensorArenaSize`) y arranca en
modo streaming para no dejar la demo muerta. Al conectar, `setup()` imprime
cuánto arena se usó de verdad, que es la cifra para ajustar este número.

## Probar la conexión con la app, paso a paso

1. Sube el sketch y **desconecta la placa del PC**: aliméntala con la power bank.
   El LED queda apagado hasta que alguien se conecta.
2. Sirve la app. Web Bluetooth exige contexto seguro, así que `localhost` vale:
   ```bash
   cd app && python3 -m http.server 8000
   ```
   Abre `http://localhost:8000` en **Chrome o Edge** (Firefox y Safari no tienen
   Web Bluetooth).
3. Entra al **Taller** y dale a **conectar por BLE**.
4. En el diálogo del navegador elige **`MixLab`**. El LED de la placa se enciende
   al conectar.
5. Deberías ver el medidor de inferencia moverse: la placa arranca en modo
   inferencia y manda 2,5 líneas por segundo.
6. Para ver la señal viva, dale a **Modo señal cruda** en el panel de
   inferencia del Taller: la app escribe una `s` en la característica RX y
   aparecen las gráficas de los tres ejes. **Modo inferencia** (`i`) vuelve.

### Si algo no va

| Síntoma | Causa casi segura |
|---|---|
| `MixLab` no sale al escanear | La placa no arrancó, o el navegador no tiene Web Bluetooth |
| Sale pero no llega nada | Quedó en pausa: manda `r` |
| Llegan `D,` pero el medidor no se mueve | Está en modo streaming: manda `i` |
| El LED parpadea rápido y sin parar | `IMU.begin()` falló: revisa el `#define USAR_*` |
| El LED parpadea lento y sin parar | `BLE.begin()` falló |
| Predice siempre la misma clase | Revisa `G_A_MS2` y que `modelo_via_b.h` esté sincronizado |

## Qué placa hace qué

**El Arduino Uno clásico (R3) no puede ser el corazón de este proyecto.** No por
capricho: el ATmega328P tiene 2 KB de RAM y no tiene unidad de coma flotante, así
que un clasificador sobre ventanas de IMU no le cabe. El Uno sirve para
**capturar el dataset**; la inferencia a bordo necesita el **Nano 33 BLE**, que
además ya trae el IMU dentro.

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

El MPU6050 se maneja por registros directos a propósito: una dependencia menos
que instalar el día de la sustentación.

El apretón de manos de WebSocket del sketch del R4 lleva **SHA-1 y Base64
escritos a mano**, verificados contra los vectores de RFC 3174 y contra el
ejemplo del RFC 6455 (`dGhlIHNhbXBsZSBub25jZQ==` → `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`).

## Ancho de banda del BLE

Con el MTU por defecto una notificación BLE lleva **20 bytes útiles**, y una
muestra ocupa unos 40 caracteres: dos notificaciones por muestra. Por eso el
streaming va a **50 Hz** y el del Uno+HM-10 a **40 Hz** (y el HM-10 necesita
`AT+BAUD2` para pasar de 9600 a 38400 — a 9600 el techo son ~24 líneas/s).

Para la **demo de inferencia** esto deja de importar: solo viajan líneas JSON,
2,5 por segundo.

## Recordatorio de la entrega

`docs/requisitos.md` exige que **la placa no esté conectada al PC**, ni por datos
ni por energía. El camino Serial USB de la app es solo para desarrollar y
calibrar; la demo va con batería y BLE (o WiFi).
