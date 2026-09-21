# Requisitos duros del Miniproyecto 1

Extraídos de `Miniproyecto_1_TinyML_Guia_2026.docx` (subida por el profesor el 4-sep).
**Entrega: martes 22-sep-2026, 18:30.**

| # | Requisito | Cómo lo cumplimos | ✔ |
|---|---|---|---|
| 1 | Dataset **propio** con sensor inercial | Captura con el IMU del Nano 33 — 60 tomas en `edge-impulse/dataset/`, ver [pendientes](pendientes-dataset.md) | ◑ |
| 2 | **5 clases de movimiento + reposo** (reposo no cuenta) | agitar, remover, servir, macerar, **colar** + reposo — `colar` sigue **sin capturar**, ver [D2](pendientes-dataset.md#d2--las-clases-capturadas-no-son-las-del-readme) | ☐ |
| 3 | **Un actuador distinto por clase**; **los LEDs NO valen** | Servo, motor DC, buzzer ×2 patrones, OLED (plan B: relé) | ☐ |
| 4 | Entrenamiento en **Edge Impulse**, proyecto **público** | Enlace en [`edge-impulse/README.md`](../edge-impulse/README.md) y en el paper — bloqueado por [D1](pendientes-dataset.md#d1--las-etiquetas-del-export-vienen-por-toma) | ☐ |
| 5 | **El Arduino no puede estar conectado al PC**, ni energía ni datos | Power bank USB 5 V | ☐ |
| 6 | Si un segundo Arduino mueve actuadores, ese enlace **también inalámbrico** | BLE GATT (o una sola placa) | ☐ |
| 7 | **MVP funcional**, no maqueta | Demo en vivo | ☐ |
| 8 | **Paper formato IEEE** | `paper/` | ☐ |
| 9 | Código entregado | Este repositorio | ☑ |
| 10 | Sustentación **≤15 min** | problema → solución → pruebas | ☐ |

> ◑ = parcial. El dataset existe pero le faltan una clase y la partición de
> test; el detalle y qué decidir está en
> [`docs/pendientes-dataset.md`](pendientes-dataset.md).

## Comodín

Se puede usar una app móvil **una sola vez** entre el Miniproyecto 1 y el
Miniproyecto 2. Si la gastamos aquí, no queda para el 2. Por eso capturamos y
desplegamos directo en la placa.
