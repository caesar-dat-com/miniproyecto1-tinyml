# App de captura — MixLab

Webapp para **conectar la placa, ver el movimiento en vivo, grabar el dataset y
mostrar la inferencia**. HTML, CSS y JavaScript planos: sin build, sin
dependencias y sin red al ejecutar.

## Cuatro formas de conectar

| Transporte | Requisitos | Uso previsto |
|---|---|---|
| **Bluetooth LE** | Chrome/Edge de escritorio o Chrome en Android · contexto seguro | El camino de la demo |
| **WiFi** | WebSocket en la red local | Uno R4 WiFi / ESP32 |
| **Serial USB** | Chrome/Edge de escritorio · contexto seguro | Solo desarrollo (ver aviso) |
| **Simulador** | nada | Probar la interfaz sin hardware |

El **simulador** genera las seis clases con firmas distintas y ruido encima.
Sirve para enseñar el flujo completo, probar los exports y trabajar en la
interfaz sin tener la coctelera en la mano.

### Contexto seguro: el requisito que sorprende

Web Bluetooth y Web Serial **solo funcionan sobre `https://` o en `localhost`**.
Una página abierta con doble clic (`file://`) o servida por HTTP desde otra
máquina **no puede conectar**, y el navegador no siempre lo explica. La app
detecta el caso y lo avisa arriba.

Al revés también incomoda: una página en **HTTPS no puede abrir un `ws://`** sin
cifrar. Así que el camino WiFi pide servir la app por **HTTP local**, y el camino
BLE pide **HTTPS o localhost**. No se pueden usar los dos desde el mismo origen.

## Correr en local

```bash
cd app
python3 -m http.server 8080
# http://localhost:8080  ← localhost cuenta como contexto seguro: BLE y Serial funcionan
```

## Las cuatro pestañas

- **Conectar** — elegir transporte y ver el formato de línea que espera la app.
- **En vivo** — dos gráficas (acelerómetro y giroscopio), frecuencia real
  medida, magnitudes y una tabla con las últimas muestras.
- **Capturar** — grabar tomas etiquetadas con cuenta atrás, ver el balance por
  clase y exportar.
- **Inferencia** — clase y confianza que manda la placa, con historial.

Las gráficas van en **un solo eje Y por figura**. Aceleración y giro tienen
unidades distintas, así que van en figuras separadas: meterlas en un marco con
dos escalas haría que dos curvas se cruzaran por decisión de escala y no porque
pase algo en el sensor. Los tres ejes llevan **etiqueta directa al final de la
línea** además de la leyenda, porque el color no basta como única identidad.

## Exportar el dataset

- **CSV** con la cabecera `timestamp,accX,accY,accZ,gyrX,gyrY,gyrZ`, la que
  espera el asistente de Edge Impulse.
- **JSON** en el formato de adquisición de Edge Impulse (`payload.sensors` +
  `payload.values`), con el `interval_ms` **medido de verdad** — no el nominal:
  si la placa entregó a 87 Hz y el archivo declara 100 Hz, el preprocesado del
  modelo queda descuadrado.

Con más de una toma se descarga un **`.zip`**. El empaquetador está escrito en
`recorder.js` (método *stored*, sin compresión, con su CRC-32) para no arrastrar
una librería: la app tiene que abrir sin internet.

El nombre de archivo empieza por la clase — `agitar.cesar_2026-09-17_a1b2c.csv` —
porque **Edge Impulse saca la etiqueta de lo que va antes del primer punto**.

Las tomas se guardan en `localStorage`. Sobreviven a un refresco, **no** a un
cambio de navegador ni a borrar los datos del sitio, y si se llena la cuota la
app avisa en vez de perderlas en silencio. Exporta antes de cerrar.

## Balance de clases

La barra de cada clase se pone **ámbar** cuando tiene menos de un tercio de
tomas que la clase más grande. Un dataset desbalanceado entrena un modelo que
acierta la clase mayoritaria y falla el resto, y en la matriz de confusión eso se
ve tarde.

Para separar `agitar` de `macerar` —el riesgo que ya identificó el proyecto—
conviene grabar varias repeticiones de las dos, **y que grabe cada integrante**:
con una sola mano el modelo aprende esa mano.

## Archivos

```text
index.html         Una sola página, cuatro paneles
css/app.css        Tokens de interfaz + tokens de visualización
js/protocol.js     Parser de línea, troceador de flujo, buffer circular, clases
js/transports.js   BLE · WebSocket · Serial · Simulador (una sola interfaz)
js/chart.js        Gráfica de líneas en vivo sobre canvas, con hover
js/recorder.js     Grabación de tomas, CSV, JSON de Edge Impulse y ZIP
js/main.js         Cableado de la interfaz
```

Las clases y su orden se editan en un solo sitio: la constante `CLASES` de
`js/protocol.js`.
