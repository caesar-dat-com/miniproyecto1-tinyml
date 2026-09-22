# Personaje coach de MixLab

El personaje funciona como feedback visual de la app. Las ilustraciones están en
`app/img/coach/` y sus nombres describen la intención de la pose, no el nombre
temporal con el que fueron generadas.

## Mapa de pantallas y expresiones

| Estado de MixLab | Imagen | Lectura visual | Ambiente |
|---|---|---|---|
| Recetas | `coach-welcome-confident.webp` | Bienvenida segura; invita a elegir | Respiración suave |
| Entrenar | `coach-ready-challenge.webp` | Preparada para el reto | Balanceo leve |
| Servicio, antes de iniciar | `coach-guide-enthusiastic.webp` | Presenta la receta con energía | Respiración suave |
| Servicio activo | `coach-ready-challenge.webp` | Concentración y acción | Balanceo leve |
| Taller | `coach-guide-presenting.webp` | Presenta sensores y herramientas | Respiración suave |
| Libreta | `coach-guide-calm.webp` | Explica los datos sin juzgar | Respiración suave |
| Resultado 0–1 estrellas | `coach-result-failed-one-star-angry.webp` | Reacción fuerte al peor resultado | Fuego y resplandor rojo |
| Resultado 2 estrellas | `coach-result-good-three-stars.webp` | Aprobación moderada | Destellos dorados |
| Resultado 3 estrellas | `coach-result-perfect-five-stars.webp` | Celebración máxima | Lluvia de estrellas y rebote |

La ilustración muestra una escala expresiva de cinco estrellas, pero el juego
conserva su escala técnica de tres. Por eso las poses `one-star`, `three-stars`
y `five-stars` se interpretan como resultado bajo, medio y excelente.

## Implementación

`main.js` decide el estado mediante `estadoCoach()` y cambia `data-mood`, la
imagen y el texto alternativo. `app.css` produce el movimiento y los ambientes
con CSS, sin GIF ni librerías. `prefers-reduced-motion` elimina las animaciones
si el sistema del usuario así lo solicita.

`manifest.json` es la fuente compacta para reutilizar las poses desde otra app
o migrar el personaje a un componente futuro.
