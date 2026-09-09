# 💧 Idea 03 — Sensores de agua/aire para control de energías renovables

![Riesgo](https://img.shields.io/badge/encaje_con_la_gu%C3%ADa-dudoso-red?style=flat-square)

**Propone:** el grupo · **ODS:** 7 (energía asequible y no contaminante) · **Estado:** candidata con reparo

## 🎯 Problema

Una microcentral o un aerogenerador pequeño no sabe en qué régimen está trabajando.
Si supiera si el caudal o el viento están en condición útil, podría cambiar de modo:
generar, cargar batería, o pararse para no dañarse.

Es la idea con **más peso técnico real** de las cuatro. El problema no es la idea.

## 🛑 El problema de encaje

La guía exige, textualmente:

> Dataset **propio** capturado con **sensor inercial**, con **5 clases de movimiento** + reposo.

Y ahí choca:

| Requisito | ¿Cumple? | Por qué |
|---|:-:|---|
| Sensor inercial | ❌ | Caudal y viento se miden con sensor de flujo o anemómetro, no con IMU |
| 5 clases de **movimiento** | ❌ | "Caudal alto/medio/bajo" son niveles de una señal, no gestos |
| Hardware disponible | ❌ | El Nano 33 BLE no trae sensor de flujo ni anemómetro; hay que comprarlos |

Presentarla tal cual es pedirle al profesor que nos deje saltar el requisito central
del miniproyecto. Puede decir que sí, pero hay que **preguntárselo antes de trabajar**,
no el 22 de septiembre.

## 🔧 Dos maneras de rescatarla

**A. Que el movimiento sea el sensor.**
Un anemómetro de copas o una rueda de agua **se mueven**. Si le montamos el Nano 33 BLE
a la parte giratoria (o al brazo que la sostiene), el IMU sí ve movimiento, y las clases
pasan a ser regímenes de giro reales:

| Clase | Qué es | Actuador |
|---|---|---|
| `calma` | Sin giro apreciable | 📟 OLED: "sin recurso" |
| `brisa` | Giro lento y regular | 🔊 Buzzer: pitido lento |
| `optimo` | Giro sostenido en rango útil | 🔌 Relé: conecta la carga |
| `rafaga` | Giro fuerte e irregular | ⚙️ Servo: mueve el freno aerodinámico |
| `turbulencia` | Vibración caótica, riesgo | 📳 Vibrador: alarma de parada |
| `reposo` | Sistema apagado | — |

Esto **sí** es un dataset inercial con 5 clases de movimiento y encaja con la guía sin
pedir permiso. Y sigue siendo la idea de energías renovables.

**B. Guardarla para el Miniproyecto 2**, si ese permite otro tipo de sensores.

## ⚠️ Riesgos de la versión A

- Hay que construir el anemómetro o la rueda (cartón, botellas, un motor viejo).
- Generar `rafaga` y `turbulencia` a voluntad requiere un ventilador y algo de paciencia.
- Es la que más trabajo de fabricación tiene de las cuatro.

## ❓ Preguntar al profesor

¿Aceptaría clases derivadas de un sistema mecánico (un anemómetro girando) en lugar de
gestos humanos, siempre que el dataset salga del IMU?
