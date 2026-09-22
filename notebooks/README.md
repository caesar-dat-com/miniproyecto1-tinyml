# Notebooks de entrenamiento — Miniproyecto 1 TinyML (UAO 2026-2)

Proyecto **Bartender**: clasificar gestos de coctelería con el IMU de un
Arduino Nano 33 BLE Sense.

Tres notebooks, pensados para ejecutarse en **Google Colab de principio a fin**.
Los tres están **ejecutados con salidas guardadas** (corrida del 21-sep-2026 por
la tarde, **con las 10 tomas de `remover` ya regrabadas**; Python 3.12 /
TensorFlow 2.21 / Keras 3.15), así que los números que aparecen en el texto son
medidos, no inventados.

| Notebook | Qué hace |
|---|---|
| [`01_datos_exploracion.ipynb`](01_datos_exploracion.ipynb) | Decodifica los 60 `.cbor`, tabla por clase (tomas, duración real, muestras), gráficas de las 6 clases, energía y espectro por eje, y **cuenta cuántas ventanas aporta cada clase** |
| [`02_entrenamiento_A_caracteristicas.ipynb`](02_entrenamiento_A_caracteristicas.ipynb) | **Vía A** del PDF: 39 características manuales por ventana → densa 20 → 10 → softmax |
| [`03_entrenamiento_B_conv1d.ipynb`](03_entrenamiento_B_conv1d.ipynb) | **Vía B**, la que usó el profesor en clase: ventana cruda normalizada → Conv1D |

Los notebooks 02 y 03 son **independientes**: cada uno carga, ventanea, parte y
entrena por su cuenta. No hace falta ejecutar el 01 antes, aunque el 01 es donde
se justifican las decisiones que los otros dos dan por tomadas.

## Cómo ejecutarlos en Colab

1. Abrir el notebook en Colab.
2. Ejecutar la **primera celda** (instala `cbor2`; el resto ya viene en Colab).
3. En la **segunda celda** hay que darle el dataset. Tres formas, la que sea:
   - montar Google Drive y dejar la carpeta en `MyDrive/tinyml/dataset`,
   - subir un `.zip` con `files.upload()` (el propio notebook lo descomprime),
   - o definir `MP1_DATASET=/ruta` si se ejecuta en local.
4. `Entorno de ejecución → Ejecutar todas`.

**Qué hay que subir** — la carpeta `edge-impulse/dataset/` del repo, o un `.zip`
de ella, con esta estructura:

```
dataset/
  info-6clases.labels          <- etiquetas buenas: 6 clases × 10 tomas
  training/*.cbor              <- 60 tomas
```

> ⚠️ **No subir `info.labels`.** Ese archivo trae 60 etiquetas distintas, una
> por toma, así que entrenaría 60 clases de una muestra cada una
> ([issue #1](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/1)).
> Los notebooks leen `info-6clases.labels` y solo ese.

No hace falta GPU: con T4 o con CPU, los tres notebooks tardan pocos minutos.

## Decisiones, y por qué

### 62,5 Hz → una ventana de 2 s son **125 muestras**

`payload.interval_ms = 16,0` en las 60 tomas → `fs = 1000/16 = 62,5 Hz`. El
ejemplo de clase usaba `ventana = 100` a 100 Hz, que allí eran 1,0 s; copiar ese
100 aquí daría 1,6 s. Los notebooks **verifican la frecuencia con un `assert`**
antes de ventanear.

Se eligió **W = 125 (2,00 s), paso = 25 (0,4 s, 80 % de solape)**:

- En 2 s caben ~3,8 ciclos del gesto más lento (`servir`, f dominante 1,9 Hz) y
  ~11 del más rápido (`agitar`, 5,8 Hz). Con 1 s, `servir` no llegaría a 2 ciclos.
- La toma más corta dura 4,016 s (251 muestras): con W=125 y paso 25 caben 6
  ventanas; con W=200 caben 2 y con W=251 solo 1.
- El paso 25 sube el dataset de 444 a **1020 ventanas**. El solape alto **no**
  infla la métrica porque el split es por toma.
- El notebook 02 incluye un barrido de W ∈ {64, 96, 125, 200}: todas las
  configuraciones razonables caen dentro de la desviación de la validación
  cruzada, así que la ventana se eligió por los argumentos físicos de arriba,
  no por perseguir el mejor número.

### Split **por toma**, nunca por ventana (issue #3)

`GroupShuffleSplit` agrupando por **archivo de origen**: las ~17 ventanas de una
toma van todas al mismo lado. Cada notebook llama a `verifica_sin_fuga()`, que
lanza un `assert` si alguna toma aparece en dos particiones.

El notebook 02 lo demuestra con un experimento: **mismo modelo, mismos datos**,
cambiando solo cómo se parte.

| | exactitud test |
|---|--:|
| split aleatorio **por ventana** (incorrecto) | **0,980** |
| split **por toma** (correcto) | **0,886** |
| | **+9,4 pp de inflado artificial** |

`GroupShuffleSplit` no estratifica, así que un split único reparte mal las
tomas. Por eso el resultado que se cita es el de **validación cruzada agrupada
de 5 pliegues** (`StratifiedGroupKFold`), donde cada toma pasa por test
exactamente una vez.

### Ejes: **solo acelerómetro (3)**

`mag*` fuera por diseño (issue #5) y `gyr*` fuera **por la Vía A** — en la B
la medición ahora lo pide, y se explica abajo:

| Ejes | Vía A (CV agrupada) | Vía B (CV agrupada) |
|---|--:|--:|
| **acc (3)** | **0,951 ± 0,031** | 0,987 ± 0,012 |
| acc + gyr (6) | 0,942 ± 0,025 | **0,995 ± 0,005** |
| acc + gyr + mag (9) | 0,99 (split único) | 0,969 ± 0,040 |

- **Magnetómetro fuera.** Mide el campo magnético local — hacia dónde apunta la
  coctelera y qué metal hay cerca —, que fue casi constante dentro de cada clase
  durante la sesión de captura. En la Vía A dispara la exactitud a 0,99: esa
  subida **mide la fuga, no el aprendizaje**, y desaparece en la demo en otro
  salón. En la Vía B ni siquiera mejora.
- **Giroscopio fuera en esta entrega, pero la medición cambió de signo.** Con
  las tomas viejas de `remover` empeoraba las dos vías (0,927 → 0,904 en A,
  0,986 → 0,968 en B). Con `remover` regrabado sigue empeorando la **Vía A**
  (0,951 → 0,942) — duplicar canales con ~1000 ventanas sobreajusta la red de
  20 neuronas — pero **mejora la Vía B** (0,987 → 0,995) y le reduce la
  desviación entre pliegues de 0,012 a 0,005. La hipótesis física original
  (`servir` tiene `std_gyr ≈ 14,5` con `std_acc ≈ 0,24`: rotación casi pura)
  aguanta ahora que las seis clases tienen movimiento real. **Se entrega con
  3 ejes** — es lo exportado al sketch y la ganancia es de +0,8 pp sobre un
  0,987 que ya basta — y pasar la B a 6 ejes queda como la primera mejora a
  probar después de la entrega.

Como efecto lateral, con 3 ejes la Vía A da **exactamente las 39
características** del PDF del profesor (3 RMS + 3 asimetría + 3 kurtosis +
9 amplitudes FFT + 9 picos de frecuencia + 12 PSD).

### Desbalance de `remover` (issue #4)

Medido en el notebook 01, con W=125 y paso 25:

| clase | ventanas | % del total | veces menos que la mayor |
|---|--:|--:|--:|
| `agitar` | 120 | 11,8 % | 1,75× |
| `macerar` | 210 | 20,6 % | 1,00× |
| **`remover`** | **60** | **5,9 %** | **3,50×** |
| `reposo` | 210 | 20,6 % | 1,00× |
| `reposo_mano` | 210 | 20,6 % | 1,00× |
| `servir` | 210 | 20,6 % | 1,00× |
| **total** | **1020** | | |

La causa es la duración: `remover` son 40,2 s de grabación contra 100,2 s de las
clases largas, y el número de ventanas sale proporcional a los **segundos**, no
al número de tomas. Mitigación en los notebooks: `class_weight` inverso a la
frecuencia **y** reporte de matriz de confusión + recall por clase, nunca solo
la exactitud global.

**Esta tabla no cambió con la regrabación del 21-sep**: las tomas nuevas de
`remover` también duran 4 s, así que el issue #4 sigue parcialmente abierto. Lo
que sí cambió es que, con movimiento real dentro, esas 60 ventanas ya bastan:
el recall de `remover` en CV pasó de 0,72 a **1,00** en la Vía A y de 0,90 a
**1,00** en la B.

### Normalización ajustada solo en train

El código de clase aplicaba `StandardScaler` sobre **todos** los datos antes de
partir, lo que filtra estadísticos del test al entrenamiento. Aquí se ajusta con
las ventanas de train y se aplica tal cual a validación y test. En la Vía B esas
6 constantes (3 medias + 3 desviaciones) se exportan a `via_b_int8.h` para que
el sketch normalice en el MCU exactamente igual.

## Resultados

Validación cruzada agrupada por toma, 5 pliegues, 3 ejes, W=125, paso 25:

| | Vía A (39 car. + densa 20/10) | Vía B (Conv1D) |
|---|--:|--:|
| Exactitud CV agrupada | 0,951 ± 0,031 | **0,987 ± 0,012** |
| Exactitud media por clase | 0,960 | **0,990** |
| Recall `agitar` / `macerar` / `servir` | 1,00 / 0,95 / 0,99 | 1,00 / 0,97 / 0,97 |
| Recall `reposo` / `reposo_mano` | 0,97 / 0,86 | 1,00 / 1,00 |
| **Recall `remover`** | **1,00** | **1,00** |
| Parámetros | 1 076 | 6 150 |
| Preproceso en el MCU | FFT de 125 puntos × 3 ejes | restar media, dividir desviación |
| `.tflite` int8 | **4,41 KB** | **15,25 KB** |
| Exactitud tras cuantizar | −1,2 pp | **0,0 pp** |

**Se despliega la Vía B.** Más exactitud, mucha menos varianza entre pliegues,
recall perfecto en `reposo`/`reposo_mano` (la A los confunde entre sí) y un
preproceso en el MCU que son dos operaciones en vez de una FFT. Además no
pierde nada al cuantizar a int8.

Con `remover` regrabado las dos vías lo clasifican perfecto, así que ya no es
la clase que decide: **la que decide ahora es `reposo_mano`**, donde la A se
queda en 0,86 y la B llega a 1,00.

### ¿Cabe en el Nano 33 BLE?

**Sí, con mucho margen.** El nRF52840 tiene **256 KB de SRAM y 1 MB de flash**.
El array C del modelo vive en **flash** (es `const`); lo que compite por la RAM
es el tensor arena más el intérprete.

| Concepto | Vía A | Vía B | Dónde |
|---|--:|--:|---|
| `.tflite` int8 | 4,41 KB | 15,25 KB | flash (1024 KB) → 1,5 % |
| Tensor arena (cota superior) | 0,09 KB | 5,12 KB | RAM |
| Intérprete TFLite Micro (aprox.) | 8 KB | 8 KB | RAM |
| Buffer del IMU (125×3 `float`) | — | ~1,5 KB | RAM |
| **RAM estimada** | **≈ 8 KB (3 %)** | **≈ 15 KB (6 %)** | de 256 KB |

El arena reportado es una **cota superior**: se calcula sumando la salida de
cada capa con lote 1 y 1 byte por valor. TFLite Micro reutiliza buffers, así que
el real es menor.

Cada notebook deja escritos el `.tflite` y un `.h` con el array C
(equivalente a `xxd -i`); el de la Vía B incluye además las constantes de
normalización, el tamaño de ventana y los nombres de clase.

## Qué queda pendiente

Por orden de urgencia para la entrega:

1. **Falta la clase `colar`** ([issue #2](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/2)).
   Con lo capturado hay 4 movimientos (`agitar`, `remover`, `servir`, `macerar`)
   más dos variantes de reposo. El requisito 2 de la guía pide **5 movimientos +
   reposo**, así que **el dataset tal como está no cumple**. Son ~2 min de
   captura: 10 tomas × 10 s.
2. ~~**Volver a grabar `remover`.**~~ ☑ **Hecho el 21-sep.** Las tomas viejas
   tenían `std_acc ≈ 0,06`, del mismo orden que `reposo` (0,03) — casi sin
   movimiento en la señal, así que lo que separaba `remover` de `reposo` era el
   vector gravedad medio, o sea la **orientación**. Las tomas regrabadas miden
   **`std_acc` 0,645 de mediana** (0,380–1,316 por toma) y el recall en CV sube
   a **1,00 en las dos vías**. Detalle y evidencia en
   [`docs/pendientes-dataset.md`, D7](../docs/pendientes-dataset.md#d7--remover-no-tenia-movimiento-capturado).
   **Lo que no se arregló:** las tomas nuevas siguen durando 4 s, así que
   `remover` sigue siendo 60 de 1020 ventanas y el
   [issue #4](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/4)
   sigue parcialmente abierto. Faltan tomas de 10 s.
3. **Capturar una partición de test de verdad**
   ([issue #3](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/3)).
   El split por toma la simula bien, pero lo correcto es grabar 2–3 tomas por
   clase aparte y subirlas con `--category testing`. Si se deja que Edge Impulse
   parta solo, parte **por ventanas**, que es justo el error que infla 9,4 pp.
4. **Proyecto público de Edge Impulse** (requisito 4). Estos notebooks lo
   complementan — sirven para justificar las decisiones y para el paper —, pero
   **no lo sustituyen**. Falta re-subir el dataset con `info-6clases.labels` y
   confirmar que *Data acquisition* muestra 6 clases de 10 tomas.
5. **Nada de esto se ha ejecutado en la placa.** Ni el tensor arena real, ni la
   latencia de inferencia, ni el consumo. Todos los números de memoria son
   estimaciones de sobremesa y así está dicho dentro de los notebooks. Hay que
   compilar y cronometrar antes de prometer la latencia de 0,4 s entre
   predicciones.
6. **`reposo` y `reposo_mano` se confunden entre sí** en la Vía A (recall 0,97 y
   0,86; la B las separa perfecto). Para el MVP da igual — las dos disparan la
   misma acción, ninguna —, así que una opción razonable es fusionarlas en una
   sola clase `reposo` y quedarse con 5. Hay que decidirlo en grupo.
7. **Probar la Vía B con acelerómetro + giroscopio.** Con `remover` regrabado,
   6 ejes dan 0,995 ± 0,005 en CV contra 0,987 ± 0,012 con 3. No se metió en la
   entrega porque cambia modelo *y* sketch a última hora, pero es la primera
   mejora a probar después.

## Archivos generados

Al ejecutar los notebooks se escriben, junto a ellos:

```
via_a_int8.tflite   via_a_int8.h     <- Vía A cuantizada + array C
via_b_int8.tflite   via_b_int8.h     <- Vía B cuantizada + array C + constantes de normalización
```

## Referencias

- [`docs/metodologia-clase.md`](../docs/metodologia-clase.md) — metodología del
  profesor, sacada de la grabación del 15-sep.
- [`docs/requisitos.md`](../docs/requisitos.md) — requisitos duros de la guía.
- [`docs/pendientes-dataset.md`](../docs/pendientes-dataset.md) — los 5
  hallazgos del dataset con su issue en GitHub.
