# 🍸 Idea 04 — Estación de coctelería que enseña a preparar tragos

![Favorita](https://img.shields.io/badge/⭐-favorita_del_grupo-gold?style=flat-square)
![Riesgo](https://img.shields.io/badge/riesgo-medio-yellow?style=flat-square)
![Originalidad](https://img.shields.io/badge/originalidad-alta-brightgreen?style=flat-square)

**Propone:** el grupo · **ODS:** 8 (trabajo decente) y 12 (consumo responsable) · **Estado:** favorita

## 🎯 Problema

Aprender coctelería se hace mirando videos y repitiendo a ciegas. Nadie te dice si
**agitaste** el tiempo suficiente, si **removiste** con la técnica correcta o si te
pasaste sirviendo. En un bar eso se traduce en tragos inconsistentes, producto
desperdiciado y meseros que tardan meses en formarse.

Un curso presencial de bartender en Cali cuesta entre $300.000 y $800.000. Un sensor
de $60.000 que corrige la técnica en tiempo real es otra puerta de entrada al oficio.

## 🍹 Cómo funciona — "Cooking Mama, pero de cócteles"

La placa va **pegada a la coctelera** (o en una muñequera). El sistema guía una receta
paso a paso: pide un gesto, reconoce si lo estás haciendo, y cada gesto tiene su propio
actuador confirmando. Al final da un **puntaje de ejecución**.

```
   Receta: Mojito
   ┌──────────────────────────────────────────┐
   │ 1. 🌿 Macerar la menta      → ✅ 8 golpes │
   │ 2. 🥄 Remover con hielo     → ⏳ 4 s...   │
   │ 3. 🍾 Servir el ron         → ⬜ pendiente│
   │ 4. 🫙 Agitar 10 s           → ⬜ pendiente│
   │ 5. ⬇️ Colar en el vaso       → ⬜ pendiente│
   └──────────────────────────────────────────┘
```

## 🤲 Las 6 clases

| # | Clase | Gesto real | Firma en el IMU | ⚙️ Actuador | Qué hace |
|:-:|---|---|---|---|---|
| 1 | `agitar` | Shake con la coctelera | Oscilación fuerte y periódica, 2–4 Hz, picos altos | 📟 **Pantalla OLED** | Cuenta regresiva `AGITAR 10s` y barra de progreso |
| 2 | `remover` | Stir con cuchara en vaso mezclador | Rotación suave y sostenida, amplitud baja | ⚙️ **Servomotor** | Aguja que avanza como medidor de dilución |
| 3 | `servir` | Pour, inclinar la botella | Inclinación mantenida ~70–90°, casi sin vibración | 🔊 **Buzzer** | Tono que sube con los ml; pita al llegar a la medida |
| 4 | `macerar` | Muddle, machacar menta/lima | Golpes verticales cortos y repetidos, alta frecuencia | 📳 **Motor DC vibrador** | Un pulso corto por golpe válido |
| 5 | `colar` | Strain / volcar al vaso final | Giro decidido de ~180° y parada | 🔌 **Relé** | Enciende la luz de la estación: trago listo |
| 6 | `reposo` | Coctelera quieta en la barra | Solo gravedad, varianza casi nula | — | Nada |

✅ Cinco actuadores **físicamente distintos**. Ningún LED.

## 🏗️ Arquitectura

```
        ┌───────────────────────────────────────────────┐
        │  🍸 Coctelera instrumentada                   │
        │  Arduino Nano 33 BLE + power bank             │
        │  IMU → Edge Impulse → clase + confianza       │
        │  OLED y buzzer montados en la misma coctelera │
        └────────────────────┬──────────────────────────┘
                             │  BLE (notify)
                             ▼
        ┌───────────────────────────────────────────────┐
        │  🎛️ Estación de barra                         │
        │  ESP32 con batería propia                     │
        │  Servo · motor vibrador · relé de la luz      │
        └───────────────────────────────────────────────┘
```

Aquí las dos placas se justifican solas: la coctelera se agita con violencia y no puede
llevar colgando un servo ni un relé. **Sin un solo cable al PC.**

Versión mínima si el tiempo aprieta: una sola placa en una muñequera con los cinco
actuadores en una cajita al lado, unidos por cable corto a la misma placa.

## 🛒 Compras

| Componente | Para qué | 💰 Aprox. |
|---|---|---|
| OLED SSD1306 0.96" I2C | Paso actual y temporizador | $5.000 |
| Servomotor SG90 | Medidor de dilución | $4.000 |
| Buzzer pasivo | Guía de servida | $1.000 |
| Motor DC vibrador | Confirmación de macerado | $2.000 |
| Módulo relé 5 V | Luz de "trago listo" | $3.000 |
| Power bank | Alimentación sin PC | $15.000–30.000 |
| ESP32 (si van dos placas) | Receptor BLE | $20.000 |
| Coctelera + cuchara + macerador | Utilería de la demo | prestada o $30.000 |

**Total: $30.000 con una placa · ~$55.000 con dos.**

## ⚠️ Riesgos

| Riesgo | Gravedad | Mitigación |
|---|:-:|---|
| `agitar` y `macerar` son ambos "sacudidas": el modelo puede confundirlos | 🔴 alta | Son distintos en **eje y frecuencia** (macerar es vertical y más rápido). Usar giroscopio además del acelerómetro y ventana de 2 s |
| Líquido real cerca de la electrónica | 🟡 media | Demo **en seco** o con agua y la placa en bolsa sellada. Nadie exige alcohol |
| La app "Cooking Mama" gastaría el comodín | 🟡 media | Que la app sea opcional: el MVP es la coctelera + OLED. La app queda para el Miniproyecto 2 |
| Cada persona agita distinto | 🟢 baja | Capturar con los tres integrantes; eso vuelve el modelo más robusto, no menos |

## 💪 Por qué es buena idea

- Los cinco gestos son **naturalmente distintos** en el espacio del acelerómetro:
  oscilación, rotación, inclinación, impacto vertical y giro. Es de los conjuntos más
  fáciles de separar que se pueden armar con la mano.
- **Casi no hay trabajo publicado.** Para el paper eso vale: hay precedentes que citar
  (ver [`research/estado-del-arte.md`](../research/estado-del-arte.md)) pero no un
  proyecto igual del cual se sospeche una copia.
- La demo se explica sola en 15 minutos y se ve en vivo.

## ❓ Preguntar al profesor

1. ¿La pantalla OLED cuenta como actuador o la equipara a un LED?
2. Si la app móvil queda como extra opcional y no como parte del MVP, ¿gasta el comodín?
