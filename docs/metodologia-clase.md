# Metodología de entrenamiento — extraída de la clase del 15-sep-2026

Fuente: grabación `2026-09-15_...1855.mp4` (2 h 42 min) + PDF
`Ejemplo Clasificacion Movimiento Kit Arduino 2025 01.pdf` + notebook
`TinyML_UAO_And_Keras_TF2.ipynb`. Todo del profesor Juan Camilo Giraldo.

## Lo que el profesor hizo en vivo

Colab `Mini_Proyecto2TinyML.ipynb`, runtime **T4 (Python 3)**.

### 1. Carga de datos (min ~115 de la grabación)

```python
nombre = nombre1 + str(a) + ".json"
RutaFile = str(nombre)
dataframe = pd.read_json(nombre)
Valores = dataframe.iloc[:,:].values
if i == 0:
    DatosOri1 = Valores[7,2][0:-1]
    Dato1 = np.array(DatosOri1)
    print(Dato1.shape)
    Dato1 = Dato1[0:600,:]          # recorte a 600 muestras
    Datos = Dato1
else:
    DatosOri2 = Valores[7,2][0:-1]
    Dato2 = np.array(DatosOri2)
    Dato2 = Dato2[0:600,:]
    Datos = np.concatenate((Datos, Dato2), axis=0)
```

`Valores[7,2]` es el campo `payload.values` del JSON de Edge Impulse.
Resultado que mostró en pantalla: **`(30000, 3)`** = 5 clases × 10 tomas × 600
muestras, **3 ejes** (solo acelerómetro).

### 2. Normalización y ventaneo (pegado por él en el chat de la reunión)

```python
from sklearn.preprocessing import StandardScaler
scaler  = StandardScaler()
DatosN  = scaler.fit_transform(Datos)

ventana = 100      # muestras por ventana
paso    = 50       # solapamiento del 50 %
X, y = [], []
for c in range(n_clases):
    ini = c * 6000
    fin = ini + 6000
    for j in range(ini, fin - ventana, paso):
        X.append(DatosN[j:j+ventana, :])
        y.append(c)
X = np.array(X); y = np.array(y)
```

### 3. Modelo

El PDF plantea **dos caminos** y hay que justificar cuál se toma:

- **A · Características manuales + RNA densa.** Por ventana: 3 RMS + 3 asimetría
  + 3 kurtosis + 9 amplitudes FFT + 9 picos de frecuencia + 12 PSD = **39
  características** → densa 20 → 10 → softmax.
- **B · Datos crudos + aprendizaje profundo.** La ventana entra tal cual
  (100×3) a una **Conv1D**. Más cómputo y más datos, pero sin ingeniería manual.

En clase usó la vía B (Conv1D) sobre las ventanas normalizadas.

### 4. Flujo completo que exige el profesor

Recolección → Preprocesamiento → Diseño del modelo → Entrenamiento →
Evaluar y optimizar → **Conversión del modelo (TFLite)** → Despliegue →
Inferencias.

## Diferencias con NUESTROS datos (importante)

| | Clase del profesor | Nuestro export |
|---|---|---|
| Formato | `.json` | **`.cbor`** → hay que decodificar con `cbor2` |
| Ejes | 3 (accel) | **9** (accX/Y/Z, gyr, mag) |
| Frecuencia | 100 Hz | **62,5 Hz** (`interval_ms = 16.0`) |
| Muestras/toma | 600 | **~626** (y `remover` mucho menos) |
| Clases | 5 | 6 capturadas, pero falta `colar` (issue #2) |

Consecuencias a decidir y documentar:

1. **62,5 Hz, no 100 Hz.** Una ventana de 2 s son **125 muestras**, no 200. Si
   se copia `ventana=100` del profesor, la ventana real es de 1,6 s.
2. **El magnetómetro sobra** (issue #5): mete sesgo de orientación del sitio.
   Lo mínimo es accel; giroscopio se justifica para gestos de rotación.
3. **`remover` dura ~4 s contra 10 s del resto** (issue #4): con ventaneo fijo
   aporta ~2,5× menos ventanas y desbalancea. Contarlas y balancear.
4. **No hay partición de test** (issue #3). El split debe ser **por toma, nunca
   por ventana**: ventanas solapadas de la misma toma en train y test inflan la
   exactitud de forma artificial. Este es el error más caro y el más fácil de
   cometer.

## Restricciones del despliegue (Nano 33 BLE)

- La salida final debe ser **TFLite cuantizado a int8**, exportado como array C
  (`xxd -i`) o vía Edge Impulse.
- Memoria: el Nano 33 BLE tiene 256 KB de RAM. El modelo y el tensor arena
  tienen que caber; reportar tamaño en KB.
- Requisito 4 de la guía: el entrenamiento **también** debe quedar en un
  proyecto **público de Edge Impulse**. Colab no lo reemplaza, lo complementa
  (sirve para justificar decisiones y para el paper).
