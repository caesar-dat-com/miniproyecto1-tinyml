# Sistema visual Comic Fighter de MixLab

## Objetivo

Presentar el proyecto TinyML como una app de entrenamiento y juego, sin ocultar
la parte técnica del vaso inteligente. La interfaz combina una barra elegante
con el ritmo visual de un cómic de lucha.

## Lenguaje visual

- **Tinta:** bordes blancos gruesos y sombras negras duras.
- **Energía:** amarillo para acciones, rojo para alarma, verde para acierto y
  azul para información técnica.
- **Viñetas:** esquinas asimétricas, pequeñas inclinaciones y paneles con trama.
- **Movimiento:** entradas laterales, brillo, respiración del personaje,
  cronómetro en alarma y celebraciones por resultado.
- **Jerarquía:** una acción principal amarilla por pantalla y controles
  secundarios oscuros.

## Estados del personaje

La función `estadoCoach()` de `app/js/main.js` decide la pose y el mensaje.
También escribe `data-view` y `data-mood` en `<body>` para que CSS pueda cambiar
el ambiente sin acoplarlo al motor TinyML.

## Funcionalidad preservada

El rediseño no modifica:

- Parser `D`, `I` y `H`.
- Bluetooth LE UART Nordic.
- WebSocket para ESP32 o Uno R4 WiFi.
- Serial USB a 115200 baudios.
- Simulador, captura, exportación CSV/JSON/ZIP y gráficas.
- Clases `agitar`, `remover`, `servir`, `macerar`, `colar` y `reposo`.
- Umbral de confianza, caducidad de inferencia, recetas, puntuación y Libreta.

## Accesibilidad y rendimiento

- Los controles siguen teniendo al menos 48 px para uso táctil.
- El color no es la única señal: texto, forma y posición refuerzan el estado.
- `prefers-reduced-motion` desactiva animaciones no esenciales.
- Las imágenes del coach están en WebP transparente y pesan menos de 1 MB en
  conjunto.
- No se añadieron dependencias, fuentes remotas ni procesos de compilación.
