<div align="center">

# 🍸 Miniproyecto 1 — TinyML en movimiento

### IA en Dispositivos Móviles y Embebidos · UAO 2026-2 · Grupo 2

![Fase](https://img.shields.io/badge/fase-ideaci%C3%B3n-yellow?style=for-the-badge)
![Entrega](https://img.shields.io/badge/entrega-22%20sep%202026-red?style=for-the-badge)
![Ideas](https://img.shields.io/badge/ideas-4%20candidatas-blue?style=for-the-badge)

![Arduino](https://img.shields.io/badge/Arduino_Nano_33_BLE-00979D?style=flat-square&logo=arduino&logoColor=white)
![Edge Impulse](https://img.shields.io/badge/Edge_Impulse-3B47CE?style=flat-square&logo=edgeimpulse&logoColor=white)
![TinyML](https://img.shields.io/badge/TinyML-FF6F00?style=flat-square&logo=tensorflow&logoColor=white)
![BLE](https://img.shields.io/badge/BLE-0082FC?style=flat-square&logo=bluetooth&logoColor=white)
![C++](https://img.shields.io/badge/C%2B%2B-00599C?style=flat-square&logo=cplusplus&logoColor=white)

**César Reyes** · **Juan Camilo Díaz Rangel** · **Sebastián Santana**
Profesor: Juan Camilo Giraldo Londoño

</div>

---

## 🟡 Estado: ideación

Tenemos **4 ideas propias** sobre la mesa. La favorita del grupo es la 🍸 **estación de
coctelería**. Nada está cerrado todavía: falta llenar la matriz y escoger.

| # | Idea | Qué mide | ODS | Estado |
|:-:|---|---|:-:|:-:|
| ⭐ 04 | [🍸 **Bartender — Cooking Mama de cócteles**](ideas/04-bartender-cocteles.md) | Gestos de coctelería | 🎯 8 · 12 | **favorita** |
| 01 | [🎾 Entrenador de tenis](ideas/01-tenis-entrenador.md) | Golpes de raqueta | 🏅 3 · 4 | candidata |
| 02 | [🏆 Tenis social](ideas/02-tenis-social.md) | Golpes + puntuación | 🏅 3 | candidata |
| 03 | [💧 Sensores de agua/aire](ideas/03-sensores-renovables.md) | Caudal / viento | ⚡ 7 | ⚠️ ver riesgo |

> ⚠️ **La idea 03 tiene un problema serio de encaje**, no de calidad: la guía exige
> **5 clases de movimiento** capturadas con **sensor inercial**. Agua y viento no son
> gestos y el Nano 33 BLE no trae sensor de caudal ni anemómetro. Está desarrollada en
> el repo con dos maneras de rescatarla, pero hay que leerlas antes de votarla.

📊 **La decisión se toma en [`decision/matriz.md`](decision/matriz.md).** Fecha objetivo: **jueves 11-sep.**

---

## 📋 Reglas que ninguna idea puede romper

Sacadas de la guía del profesor ([`docs/requisitos.md`](docs/requisitos.md)):

| ✅ | Requisito |
|:-:|---|
| 🎯 | Dataset **propio** con sensor inercial: **5 clases de movimiento + `reposo`** (reposo no cuenta) |
| ⚙️ | **Un actuador distinto por clase**. Servo, motor DC, buzzer, relé, pantalla, vibrador. **Los LEDs NO valen** |
| 🧠 | Entrenamiento en **Edge Impulse**, proyecto **público**, enlace en el informe |
| 🔌 | El Arduino **no puede estar conectado al PC**, ni para energía ni para datos → power bank + BLE/WiFi |
| 📡 | Si una segunda placa mueve los actuadores, ese enlace **también** inalámbrico |
| 🃏 | **Comodín:** la app móvil se usa **una sola vez** entre el Miniproyecto 1 y el 2 |
| 🚀 | MVP funcional (no maqueta) · **paper IEEE** · código · sustentación ≤15 min |

### 🃏 Ojo con el comodín

Tres de nuestras cuatro ideas dicen "app". **Si la app móvil es parte del MVP aquí,
se gasta el comodín y no queda para el Miniproyecto 2.** Salida limpia: que la app
sea *opcional* y que el MVP viva completo en la placa + actuadores. Se ve mejor en la
sustentación y no cuesta el comodín.

---

## 🔧 Hardware

**Arduino Nano 33 BLE** (lo tiene Santana). Ojo con la revisión:

| Revisión | IMU | Librería |
|---|---|---|
| Rev1 | LSM9DS1 | `Arduino_LSM9DS1` |
| **Rev2** | BMI270 + BMM150 | `Arduino_BMI270_BMM150` |

Con la librería equivocada `IMU.begin()` devuelve `false` y el sketch se cuelga en el
`setup()` sin decir por qué. Mirar la serigrafía antes de instalar nada.

---

## 🔬 Qué dice la literatura

Resumen en [`research/estado-del-arte.md`](research/estado-del-arte.md). Lo corto:

- 🎾 **Tenis está resuelto y bien documentado.** Clasificar drive/revés/saque con un IMU en
  la muñeca alcanza **95–98 %** de accuracy en la literatura. Es la idea de menor riesgo técnico.
- 🍸 **Coctelería está mucho menos explorada** — hay precedentes (`Cocktail`, 2011; patente de
  monitoreo de servidas por IMU) pero ningún trabajo escolar típico. Es la idea con más
  originalidad para el paper, y los gestos son bien distintos entre sí.
- ⚠️ El problema común es distinguir **movimientos visualmente parecidos**. Eso decide qué
  gestos elegir, más que el modelo que se use.

---

## 🗂️ Estructura

```
📁 docs/       Guía del profesor + tabla de requisitos duros
📁 ideas/      Las 4 propuestas del grupo + plantilla para más
📁 research/   Estado del arte y referencias
📁 decision/   Matriz de comparación y acta
```

## 🤝 Cómo aportar

1. Copiar `ideas/PLANTILLA.md` → `ideas/NN-nombre.md`
2. Llenar la tabla de 5 clases + actuador
3. Commit o PR. Si no manejan git, la mandan al grupo y la subo yo.
