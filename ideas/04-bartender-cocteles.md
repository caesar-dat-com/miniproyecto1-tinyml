# 🍸 Idea 04 — Coctelera inteligente + app interactiva

![Ganadora](https://img.shields.io/badge/🏆-idea_ganadora-gold?style=flat-square)
![Riesgo](https://img.shields.io/badge/riesgo-medio-yellow?style=flat-square)
![Originalidad](https://img.shields.io/badge/originalidad-alta-brightgreen?style=flat-square)

**Propone:** el grupo · **ODS:** 8 y 12 · **Estado:** seleccionada

## 🎯 Concepto

Una coctelera instrumentada con **Arduino Nano 33 BLE + IMU + TinyML** reconoce movimientos reales de coctelería y envía el resultado por BLE a una app móvil/tablet.

La experiencia de usuario se inspira en juegos de cocina paso a paso: la app guía la receta y el vaso mide si el usuario ejecutó correctamente el gesto solicitado.

> La app te dice qué hacer. La coctelera entiende cómo lo hiciste.

## 📱 Experiencia tipo juego

La app tendrá cuatro áreas principales:

- **Recetas:** seleccionar un cóctel y ver su secuencia.
- **Entrenar gestos:** practicar movimientos individuales.
- **Jugar:** completar una receta y recibir puntuación.
- **Progreso:** consultar precisión, historial y mejores resultados.

Durante una receta, el teléfono puede mostrar:

```text
Mojito — Paso 3 de 5

        ¡AGITA!

      ⏱ 00:12

Precisión del gesto: 92 %
██████████████████░░

⭐ ⭐ ☆
```

Una tablet puede quedarse en el menú general mientras el teléfono acompaña la ejecución en vivo.

---

## 🤲 Dataset

| # | Clase | Gesto real | Firma esperada en IMU |
|:-:|---|---|---|
| 1 | `agitar` | Shake de coctelera | Oscilación fuerte y periódica |
| 2 | `remover` | Stir con cuchara | Rotación suave y sostenida |
| 3 | `servir` | Inclinar para verter | Inclinación mantenida con baja vibración |
| 4 | `macerar` | Golpes verticales | Impactos cortos repetidos en un eje dominante |
| 5 | `colar` | Giro/inclinación final | Cambio angular claro y parada |
| 6 | `reposo` | Sin movimiento | Varianza mínima |

El dataset será **propio** y debe incluir muestras de los tres integrantes para mejorar generalización.

---

## 🏗️ Arquitectura actual

```text
         COCTELERA
             │
             ▼
┌───────────────────────────────┐
│ Arduino Nano 33 BLE           │
│                               │
│ IMU                           │
│  ↓                            │
│ TinyML / Edge Impulse         │
│  ↓                            │
│ clase + confianza             │
│                               │
│ OLED + RGB opcionales         │
│ batería interna recargable    │
└───────────────┬───────────────┘
                │ BLE
                ▼
        📱 APP / TABLET
        receta · gesto · tiempo
        confianza · puntuación
        progreso
```

El módulo electrónico va sujeto **al lateral de la coctelera**, en una carcasa compacta desmontable. La idea es integrar placa, batería, carga USB-C, interruptor y, opcionalmente, OLED/RGB en una sola pieza.

---

## 🔧 Hardware

| Componente | Uso |
|---|---|
| Arduino Nano 33 BLE / Rev2 | IMU + procesamiento + BLE |
| OLED SSD1306 0.96" I²C | Feedback local opcional |
| WS2812B RGB | Estado de sistema opcional |
| LiPo 3.7 V ~1000 mAh | Alimentación autónoma |
| TP4056 USB-C | Carga/protección de LiPo |
| MT3608 | Conversión de tensión |
| Interruptor ON/OFF | Encendido físico |
| JST | Conexión desmontable de batería |
| Carcasa 3D + velcro/abrazadera | Integración lateral |

La lista con precios y enlaces de compra está en [`../docs/materiales.md`](../docs/materiales.md).

---

## 💰 Presupuesto

- Todo desde cero: **~$337.951 COP**
- Reutilizando el Arduino del grupo: **~$177.469 COP**
- MVP mínimo sin OLED ni RGB: **~$133.569 COP**
- MVP mínimo + margen: **~$158.569 COP**

---

## 🧠 Flujo de datos

```text
acelerómetro + giroscopio
          ↓
    ventana de señal
          ↓
      Edge Impulse
          ↓
    modelo TinyML
          ↓
 gesto + confianza
          ↓ BLE
          app
```

La ventana inicial a probar será de aproximadamente **1–2 segundos**. El problema más importante será evitar confusión entre `agitar` y `macerar`; para eso se aprovecharán tanto acelerómetro como giroscopio, frecuencia y eje dominante.

---

## ⚠️ Validación pendiente

La guía original todavía indica **un actuador diferente por clase** y aclara que los LEDs no cuentan. Esta versión del proyecto está orientada a que la representación se haga en la app, así que debemos confirmar con el profesor si esto sustituye el requisito de actuadores.

También hay que confirmar si utilizar la app como parte central del MVP consume el **comodín de app móvil** del curso.

---

## 💪 Por qué elegimos esta idea

- Los gestos tienen firmas inerciales naturalmente diferentes.
- El sistema se puede demostrar en vivo de manera muy visual.
- Tiene un componente TinyML real y medible.
- La app convierte una clasificación técnica en una experiencia fácil de entender.
- Hay antecedentes científicos para reconocimiento de gestos de bebidas, pero el enfoque de tutor interactivo de coctelería sigue siendo poco explorado.
