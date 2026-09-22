# MixLab — la app

Un **bar de autor metido en una consola de doble pantalla**. Arriba el
escaparate, abajo la barra táctil: eliges cóctel, la app te pide un gesto y la
coctelera dice si lo hiciste bien.

Detrás de la puerta de servicio está el **Taller**: conectar la placa, ver el
movimiento en vivo, grabar el dataset y exportarlo.

HTML, CSS y JavaScript planos: sin build, sin dependencias y sin red al ejecutar.

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

## Dos páginas

| | |
|---|---|
| `index.html` | **Portada.** Foto de bar de fondo y controles gordos de juego. Es la puerta de entrada y está pensada para dedo. |
| `consola.html` | **La consola.** El salón de doble pantalla y, detrás, el taller. |

### La portada

Pensada para **iPad y teléfono**: nada por debajo de 56 px, sin nada que dependa
del hover, con los márgenes de seguridad de iPhone respetados y sin scroll en
ninguna orientación. En apaisado las cuatro tarjetas pasan a una fila.

La foto de fondo pesaba **1,5 MB en PNG**. Va servida en cuatro anchos
(640/960/1280/1672) en WebP con JPEG de reserva: el teléfono se baja **20 KB** y
el iPad 33 KB, un 96 % menos. Detrás hay una miniatura borrosa de 200 bytes
incrustada en el CSS para que no haya un fogonazo negro mientras baja la foto.

El velo que oscurece la foto son dos degradados, **no un `backdrop-filter`**: un
filtro a pantalla completa cuesta caro en iPad y aquí da el mismo contraste
gratis.

Las medallas de cada tarjeta salen de la **libreta real** — la portada carga
`game.js` en vez de reimplementar el formato de guardado. La Libreta aparece con
candado hasta que haya algo que anotar, y al tocarla lleva a la carta, que es lo
que hay que hacer para abrirla.

## El salón

La carta tiene cinco platos:

| | | |
|---|---|---|
| **I** | Recetas | Cinco cócteles, de una a tres copas de dificultad. Cada paso es un gesto. |
| **II** | Entrenar | Un gesto suelto, 10 s, con el medidor de confianza en vivo. |
| **III** | Servicio | La receta completa contra reloj: puntos, estrellas y precisión paso a paso. |
| **IV** | Libreta | Tus marcas, y en qué gesto flojeas. |
| **V** | Taller | La puerta de servicio (abajo). |

### Cómo se puntúa

La app **no clasifica nada**: el modelo corre en el Arduino y aquí solo se juzga
lo que llega en las líneas `I,<clase>,<confianza>`. Durante un paso se suma
tiempo mientras la clase detectada coincida con la pedida **y** la confianza
pase de `0.60`. La precisión del paso es ese tiempo entre el total.

Una inferencia más vieja de **1,5 s** se da por muerta. Sin esa regla, una placa
que deja de enviar seguiría premiando indefinidamente su último mensaje.

Estrellas: ★★★ desde 85 % de precisión media, ★★ desde 65 %, ★ desde 40 %.

> Con el **simulador**, la pantalla táctil saca unos botones para elegir qué
> gesto está fingiendo la coctelera. Así el juego se puede enseñar entero sin
> tener el hardware en la mano.

## El taller

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
index.html         Consola (salón) + taller, en una sola página
css/app.css        Tokens de la sala y de la pantalla + tokens de visualización
js/protocol.js     Parser de línea, troceador de flujo, buffer circular, clases
js/transports.js   BLE · WebSocket · Serial · Simulador (una sola interfaz)
js/chart.js        Gráfica de líneas en vivo sobre canvas, con hover
js/recorder.js     Grabación de tomas, CSV, JSON de Edge Impulse y ZIP
js/game.js         Recetas, motor de partida, puntuación y libreta
js/main.js         Cableado del salón y del taller
```

Dónde se editan las cosas, cada una en un solo sitio:

- **Clases y su orden** → `CLASES`, en `js/protocol.js`.
- **Cócteles, pasos y duraciones** → `RECETAS`, en `js/game.js`.
- **Umbral de acierto y caducidad de la inferencia** → `UMBRAL_CONF` y
  `VIDA_INFERENCIA_MS`, arriba de `js/game.js`.

## Sobre el aspecto

La interfaz usa un lenguaje de **cómic de combate**: marcos de tinta, paneles
inclinados, tramas de puntos, rayos de velocidad, colores de alto contraste y
un personaje coach que cambia de pose según la pantalla y el resultado. Sigue
siendo CSS y JavaScript locales, sin fuentes ni librerías descargadas, para que
la app continúe abriendo sin red.

Las animaciones están ligadas al estado: entrada de vistas, brillo de botones,
alarma del cronómetro, golpe de confianza, fuego al fallar y estrellas en un
resultado perfecto. `prefers-reduced-motion` reduce todo el movimiento cuando
el sistema lo solicita.

El rediseño es únicamente de presentación. No cambia `protocol.js`,
`transports.js`, `recorder.js` ni el contrato de datos con el vaso inteligente:
BLE, WebSocket, Serial USB y simulador conservan el mismo funcionamiento.

La pantalla de abajo **crece con el alto que sobre** en vez de quedarse en 4:3
fijo: en un móvil quedaban 200 px muertos debajo de la consola mientras la
carta se cortaba en el cuarto plato. En ventanas bajas se retiran además los
subtítulos del menú, antes que dejar el menú principal con scroll.

Las marcas viven en `localStorage` (`mixlab.libreta.v1`), separadas de las tomas
del dataset. Borrar la libreta no toca las tomas.
