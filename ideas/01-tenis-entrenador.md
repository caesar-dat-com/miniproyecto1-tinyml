# 🎾 Idea 01 — Entrenador de tenis

![Riesgo](https://img.shields.io/badge/riesgo-bajo-brightgreen?style=flat-square)
![Originalidad](https://img.shields.io/badge/originalidad-baja-orange?style=flat-square)

**Propone:** el grupo · **ODS:** 3 (salud) y 4 (educación) · **Estado:** candidata

## 🎯 Problema

Un jugador aficionado no tiene entrenador al lado corrigiéndole cada golpe. Repite
errores durante meses y encima se lesiona el hombro y el codo por técnica mala.

## 🎾 Cómo funciona

La placa va en la muñeca o en el mango de la raqueta. Reconoce qué golpe hizo el
jugador y le devuelve corrección inmediata: si el gesto fue completo, si le faltó
seguimiento, cuántos hizo de cada tipo en la sesión.

## 🤲 Las 6 clases

| # | Clase | Golpe | ⚙️ Actuador | Qué hace |
|:-:|---|---|---|---|
| 1 | `drive` | Derecha / forehand | 📟 **OLED** | Contador y nombre del golpe |
| 2 | `reves` | Revés / backhand | 🔊 **Buzzer** | Tono según calidad del gesto |
| 3 | `saque` | Servicio | ⚙️ **Servomotor** | Aguja que marca la potencia |
| 4 | `volea` | Volea en la red | 📳 **Motor vibrador** | Pulso corto de confirmación |
| 5 | `smash` | Remate sobre la cabeza | 🔌 **Relé** | Enciende una luz de "golpe ganador" |
| 6 | `reposo` | Caminando o esperando | — | Nada |

## 🏗️ Arquitectura

Nano 33 BLE en muñequera con power bank. Actuadores en una cajita en el antebrazo o
en el banco, por BLE a un ESP32. Sin cable al PC.

## 🛒 Compras

Las mismas cinco piezas (~$15.000) + power bank. **Total $30.000–45.000.**

## ⚠️ Riesgos

| Riesgo | Gravedad | Nota |
|---|:-:|---|
| Hay que ir a una cancha a capturar datos | 🟡 media | Se puede simular en seco, pero el modelo baja de calidad |
| `drive` y `revés` son espejo | 🟢 baja | El giroscopio los separa bien; la literatura reporta 95–98 % |
| Golpes fuertes pueden saturar el acelerómetro | 🟡 media | Configurar el rango a ±16 g |
| Es la idea **menos original** | 🟡 media | Está muy publicada. Para el paper hay que aportar algo propio |

## 💪 A favor

Es la idea de **menor riesgo técnico** de las cuatro: hay literatura que confirma que
funciona con precisión alta ([`research/estado-del-arte.md`](../research/estado-del-arte.md)),
los cinco golpes son claramente distintos y sabemos de antemano que el modelo va a andar.
