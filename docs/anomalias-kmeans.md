# Detección de anomalías con K-means — resultados medidos

Parte 2 del **Ejercicio en clase 2** (semana 9), material
*TinyML UAO · Detección de Anomalías con Edge Impulse*.

Cuaderno: [`notebooks/04_ejercicio2_tflite_anomalias.ipynb`](../notebooks/04_ejercicio2_tflite_anomalias.ipynb)
(ejecutado, con salidas y figuras incrustadas).
Cabecera para el sketch: [`firmware/nano33ble_mixlab_inferencia/anomalias_kmeans.h`](../firmware/nano33ble_mixlab_inferencia/anomalias_kmeans.h).

## Por qué hace falta

El clasificador de gestos **no puede decir «esto no lo conozco»**. Un softmax
de seis salidas siempre reparte probabilidad entre esas seis clases: si la
coctelera recibe un golpe o alguien la usa de martillo, responderá `agitar` con
toda confianza porque es lo único que sabe responder.

El detector de anomalías cubre ese hueco con aprendizaje no supervisado:

1. Características espectrales por ventana — el bloque *Spectral Analysis* de
   Edge Impulse: RMS más los tres picos de FFT (frecuencia y amplitud) por eje.
   Con 3 ejes de acelerómetro son **21 columnas**.
2. **K-means** sobre las ventanas conocidas.
3. El **puntaje de anomalía es la distancia al centroide más cercano**.
4. El **umbral** es el percentil 95 de las distancias de entrenamiento, lo que
   fija por construcción un 5 % de falsos positivos sobre datos normales.

## Configuración, elegida por medición

Se compararon dos juegos de características contra tres valores de K. El
resultado es contraintuitivo: **las 39 características del PDF del profesor
funcionan peor para esta tarea**.

| Características | Columnas | K | Detección media |
|---|---:|---:|---:|
| RMS + 3 picos | 21 | 5 | 47,2 % |
| **RMS + 3 picos** | **21** | **8** | **47,9 %** |
| RMS + 3 picos | 21 | 12 | 44,4 % |
| RMS + asimetría + kurtosis + 5 picos | 39 | 5 | 38,3 % |
| RMS + asimetría + kurtosis + 5 picos | 39 | 8 | 40,1 % |
| RMS + asimetría + kurtosis + 5 picos | 39 | 12 | 39,7 % |

Añadir asimetría, kurtosis y dos picos más mejora `macerar` (de 94,8 % a
99,0 %) pero hunde `servir` (de 73,3 % a 6,2 %). Más dimensiones reparten las
distancias de forma más uniforme y el umbral pierde poder de discriminación:
la maldición de la dimensionalidad.

**Configuración adoptada: 21 características, K = 8, umbral en el percentil 95.**

## Validación leave-one-class-out

Medir un detector de anomalías con los datos que lo entrenaron no prueba nada.
El protocolo aquí: **se saca una clase completa del entrenamiento**, se entrena
K-means solo con las cinco restantes y se mide qué fracción de las ventanas de
la clase excluida cae sobre el umbral. Es decir, se simula que ese gesto es un
evento nunca visto.

| Clase excluida | Umbral | Detectada como anomalía | Falsos positivos |
|---|---:|---:|---:|
| `agitar` | 4,388 | **100,0 %** | 5,0 % |
| `macerar` | 4,694 | **94,8 %** | 5,1 % |
| `servir` | 3,911 | **73,3 %** | 5,1 % |
| `remover` | 3,918 | 16,7 % | 5,0 % |
| `reposo` | 3,823 | 2,9 % | 5,1 % |
| `reposo_mano` | 3,914 | **0,0 %** | 5,1 % |

Los falsos positivos salen en 5,1 % en los seis casos, que es exactamente lo
que impone el umbral: confirma que el procedimiento está bien montado.

## El hallazgo: el punto ciego de baja energía

Los resultados se parten en dos regímenes con una claridad incómoda.

**Detecta bien** los gestos de energía alta y firma espectral propia: `agitar`,
`macerar`, `servir`.

**No detecta** `reposo`, `reposo_mano` ni `remover`. Y no es un fallo del
método, es una propiedad del dataset:

- `reposo` y `reposo_mano` son **físicamente casi lo mismo** — coctelera quieta
  sobre la mesa contra coctelera quieta en la mano. Al excluir una, la otra
  sigue dentro del entrenamiento y cubre la misma región del espacio de
  características. De ahí el 0,0 %.
- `remover` fue el gesto problemático desde la captura: su desviación de
  aceleración apenas supera la del reposo. Es el hallazgo
  [D7](pendientes-dataset.md#d7--remover-no-tenia-movimiento-capturado), que
  motivó la regrabación del 21-sep.

La figura PCA del cuaderno lo muestra con un panel de zoom: `agitar` se va solo
a la derecha, `macerar` hacia arriba, y las cuatro clases tranquilas comparten
la misma esquina con `reposo_mano` enterrado bajo `reposo`.

**Conclusión operativa:** un detector de anomalías por distancia es ciego en la
zona de baja energía, donde todas las clases quietas se amontonan. Para
detectar anomalías *estáticas* —la coctelera inclinada y goteando, por
ejemplo— hacen falta características de **postura** (orientación respecto a la
gravedad), no de energía.

## Costo en el dispositivo

| Concepto | Costo |
|---|---|
| 8 centroides × 21 características | 672 B |
| Media y desviación de escalado | 168 B |
| **Total en flash** | **840 B — 0,08 % del flash del Nano 33 BLE** |
| RAM | 0 B: todo es `const` y vive en flash |
| Cómputo por ventana | 8 distancias euclídeas de 21 dimensiones |

Lo que de verdad cuesta en el microcontrolador **no es el K-means, es la FFT**.
Las 21 características incluyen los tres picos espectrales por eje, así que el
sketch necesita una FFT de 125 puntos — `arduinoFFT` o `CMSIS-DSP` del
Cortex-M4. El RMS, en cambio, es una suma de cuadrados y sale gratis.

## Cómo se integra en el firmware

```c
#include "anomalias_kmeans.h"

// car[] = las 21 caracteristicas de la ventana, en el mismo orden que el cuaderno
float puntaje = anomalia_puntaje(car);
if (puntaje > ANOM_UMBRAL) {
  reportar_anomalia(puntaje);          // se ignora la etiqueta del clasificador
} else {
  reportar_gesto(etiqueta, confianza);
}
```

## Pendiente

- La sección de anomalías **todavía no está en [`paper/paper.md`](../paper/paper.md)**;
  estas tablas son el material para escribirla.
- Implementar la FFT en el sketch: hoy `anomalia_puntaje()` recibe las
  características ya calculadas.
- Capturar una anomalía **real** (golpe, caída, uso indebido) para validar
  contra algo que no sea una clase conocida excluida artificialmente.
