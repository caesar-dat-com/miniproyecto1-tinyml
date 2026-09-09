# 🏆 Idea 02 — Tenis social: presume tu golpe y tu puntaje

![Riesgo](https://img.shields.io/badge/riesgo-alto-red?style=flat-square)
![Comodín](https://img.shields.io/badge/🃏-gasta_el_comod%C3%ADn-critical?style=flat-square)

**Propone:** el grupo · **ODS:** 3 (salud) · **Estado:** candidata

<div align="center">

<img src="https://media.giphy.com/media/3m9S7LRmvndpTEIyo2/giphy.gif" height="190" alt="Golpe de tenis">

*El golpe se mide igual que en la 01. Lo que cambia — y lo que cuesta el comodín — es la capa social.*

</div>

## 🎯 Problema

Jugar solo aburre. Lo que engancha a la gente a moverse es competir y mostrar lo que
hizo. Strava lo demostró con el ciclismo: el dato compartido es el que sostiene el hábito.

## 🏆 Cómo funciona

Igual que la idea 01 en la parte de sensado, pero el foco cambia: cada golpe genera un
**puntaje de perfección** (qué tan parecido fue al gesto ideal) y el jugador marca si
hizo punto o no. Eso arma un perfil comparable con los amigos.

El puntaje sale de la **confianza que devuelve el clasificador**: si el modelo dice
`drive` con 0.97, el gesto fue limpio; con 0.62 fue sucio. Es una métrica gratis que ya
produce el modelo, no hay que inventar nada.

## 🤲 Las 6 clases

Las mismas de la idea 01 (`drive`, `reves`, `saque`, `volea`, `smash`, `reposo`), con
los mismos cinco actuadores. Lo que cambia es la capa social encima.

## 🏗️ Arquitectura

Nano 33 BLE + power bank → BLE → **app móvil** que guarda el historial y el ranking.

## ⚠️ Riesgos

| Riesgo | Gravedad | Nota |
|---|:-:|---|
| 🃏 **La app es el corazón de la idea** — sin ella no hay nada social | 🔴 alta | **Gasta el comodín.** No queda app para el Miniproyecto 2 |
| Hay que desarrollar la app además de todo lo demás | 🔴 alta | En 11 días, con paper y demo encima, es mucho |
| El "puntaje de perfección" es discutible | 🟡 media | La confianza del clasificador no es exactamente calidad técnica; hay que explicarlo bien en el paper |
| Sensado idéntico a la idea 01 | 🟢 baja | Se puede fusionar: hacer la 01 y dejar lo social como extensión futura |

## 💡 Recomendación

Esta idea y la 01 son la misma base con distinto envoltorio. Lo sensato es **hacer la
01 ahora** y guardar lo social para el Miniproyecto 2, donde el comodín de la app sí
tiene sentido gastarlo.
