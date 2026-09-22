# Sistema visual Editorial Noir de MixLab

## Objetivo

Presentar el proyecto TinyML como una app adulta de entrenamiento, sin ocultar
la parte técnica del vaso inteligente. La interfaz combina un bar nocturno
premium con el carácter de una novela gráfica contemporánea.

## Lenguaje visual

- **Paleta:** carbón, marfil, cobre quemado, verde de señal y azul técnico.
- **Tipografía:** serif editorial para títulos, sans de sistema para interfaz y
  monoespaciada para telemetría.
- **Iconografía:** SVG lineal propio; no depende de emojis del sistema.
- **Movimiento:** transiciones cortas, respiración del personaje y fuego SVG
  animado únicamente cuando el resultado es bajo.
- **Jerarquía:** una acción principal cobriza por pantalla y controles
  secundarios neutros.
- **Móvil:** personaje con opacidad baja, rejilla de dos columnas, HUD compacto
  y zonas de scroll independientes para no tapar acciones.

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

## Cobertura de iconos

El sistema vectorial cubre navegación, recetas, gestos, pantalla completa,
ayuda, reproducción, repetición, abandono, conexión BLE, WiFi, USB, simulador,
telemetría en vivo, pausa, tabla, captura, exportación, eliminación y modos de
inferencia/señal. Todos comparten `viewBox`, grosor, remates y un color semántico
controlado por CSS.
