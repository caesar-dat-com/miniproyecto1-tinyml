# Pendientes del dataset — hallazgos de la captura del 21-sep-2026

Revisión del export de Edge Impulse que está en
[`edge-impulse/dataset/`](../edge-impulse/dataset/) (60 tomas, Nano 33 BLE,
62,5 Hz, 9 ejes, 505 s).

Cada hallazgo tiene su issue abierto en GitHub; la columna *Issue* enlaza.

**Entrega: martes 22-sep-2026, 18:30.** D-1 al escribir esto, así que la columna
*Bloquea* marca lo que impide entrenar hoy mismo.

| # | Hallazgo | Issue | Bloquea | Estado |
|---|---|:-:|:-:|:-:|
| [D1](#d1--las-etiquetas-del-export-vienen-por-toma) | Las etiquetas del export vienen por toma → 60 clases, no 6 | [#1](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/1) | 🔴 sí | ☑ mitigado |
| [D2](#d2--las-clases-capturadas-no-son-las-del-readme) | Las clases capturadas no son las del README: falta `colar`, sobra `reposo_mano` | [#2](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/2) | 🔴 sí | ☐ decisión del grupo |
| [D3](#d3--no-hay-particion-de-test) | No hay partición de test: las 60 tomas están en `training/` | [#3](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/3) | 🟡 no | ☐ |
| [D4](#d4--duraciones-desparejas-entre-clases) | Duraciones desparejas: `remover` 4 s vs 10 s del resto | [#4](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/4) | 🟡 no | ☐ |
| [D5](#d5--el-magnetometro-sobra) | El magnetómetro (3 ejes `mag*`) sobra y puede meter sesgo de sitio | [#5](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/5) | 🟡 no | ☐ |
| [D6](#d6--requisitosmd-fila-2-lista-clases-de-otro-proyecto) | `docs/requisitos.md` fila 2 lista clases de otro proyecto | – | 🟢 doc | ☑ corregido |

---

## D1 — Las etiquetas del export vienen por toma

> Issue [#1](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/1)

🔴 **Bloquea el entrenamiento.** ☑ Mitigado, falta re-subir.

En `edge-impulse/dataset/info.labels` cada toma lleva su propio nombre como
etiqueta: `Agitar 01`, `Agitar 02`, … Son **60 clases de una muestra cada una**,
no 6 clases de 10. Un modelo entrenado así no aprende nada.

Se dejó el export original intacto y se generó al lado
`info-6clases.labels`, con las etiquetas normalizadas (minúsculas, sin número,
espacios a `_`):

```bash
cd edge-impulse/dataset
edge-impulse-uploader --clean --info-file info-6clases.labels
```

**Falta:** re-subir el dataset al proyecto de Edge Impulse con ese archivo y
confirmar que *Data acquisition* muestra 6 clases de 10 tomas.

---

## D2 — Las clases capturadas no son las del README

> Issue [#2](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/2)

🔴 **Bloquea.** ☐ Necesita decisión del grupo.

| Clase del README | ¿Capturada? |
|---|---|
| `agitar` | ☑ 10 tomas |
| `remover` | ☑ 10 tomas |
| `servir` | ☑ 10 tomas |
| `macerar` | ☑ 10 tomas |
| `colar` | ☐ **sin capturar** |
| `reposo` | ☑ 10 tomas |
| `reposo_mano` | ⚠️ 10 tomas, **no estaba en el plan** |

El requisito del profesor es **5 clases de movimiento + reposo**, y `reposo` no
cuenta como movimiento. Con lo capturado hoy hay **4 movimientos**
(`agitar`, `remover`, `servir`, `macerar`) más dos variantes de reposo, así que
**tal cual no cumple el requisito 2**.

Dos salidas, hay que elegir una:

- **Capturar `colar`** (10 tomas × 10 s ≈ 2 min de captura) y tratar
  `reposo_mano` como tomas extra de `reposo` o como clase negativa aparte.
- **Ascender `reposo_mano` a clase de movimiento** — no lo es: es la coctelera
  quieta en la mano. No cuela como quinto movimiento.

La primera es la única que cumple. Ver [`docs/requisitos.md`](requisitos.md) fila 2.

---

## D3 — No hay partición de test

> Issue [#3](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/3)

🟡 No bloquea, pero infla el resultado. ☐

Las 60 tomas están en `training/`; `testing/` no existe. Si se deja que Edge
Impulse haga el split solo, parte **por ventanas**, y ventanas vecinas del mismo
gesto quedan a los dos lados de la partición: el modelo ve en test casi lo mismo
que memorizó en train y la accuracy sale inflada.

**Qué hacer:** capturar 2–3 tomas por clase aparte para test, o al menos mover
tomas **completas** (no ventanas) a `testing/` con el flag `--category testing`
del uploader.

---

## D4 — Duraciones desparejas entre clases

> Issue [#4](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/4)

🟡 No bloquea. ☐

| Clase | Tomas | Duración | Total |
|---|--:|---|--:|
| `agitar` | 10 | 4 × 10 s + 6 × 4 s | 64,2 s |
| `macerar` | 10 | 10 s | 100,2 s |
| `remover` | 10 | 4 s | 40,2 s |
| `reposo` | 10 | 10 s | 100,2 s |
| `reposo_mano` | 10 | 10 s | 100,2 s |
| `servir` | 10 | 10 s | 100,2 s |

Con ventanas de 1–2 s el número de ventanas sale proporcional a la duración, no
al número de tomas: `remover` aporta **~2,5× menos ventanas** que `macerar`. El
clasificador tenderá a no predecir `remover`.

**Qué hacer:** capturar más `remover` hasta igualar segundos, o activar el
balanceo de clases en el bloque de aprendizaje y mirar la matriz de confusión
por clase, no solo la accuracy global.

---

## D5 — El magnetómetro sobra

> Issue [#5](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/5)

🟡 No bloquea. ☐

El export trae 9 ejes: `accX/Y/Z`, `gyrX/Y/Z` y `magX/Y/Z`. Los `mag*` miden el
campo magnético, que depende de hacia dónde apunta la coctelera respecto al
norte y del metal que haya cerca — no del gesto. Si se dejan dentro del impulse,
el modelo puede aprender **dónde se grabó** en vez de **qué se hizo**, y eso se
cae en la demo en otro salón.

El plan del proyecto (README, sección *Clases de movimiento*) ya decía
acelerómetro + giroscopio.

**Qué hacer:** dejar los 3 ejes `mag*` fuera del impulse. Baja de 9 a 6 ejes,
recorta el modelo y quita el sesgo de sitio. Los datos crudos se quedan en el
repo por si acaso.

---

## D6 — `requisitos.md` fila 2 lista clases de otro proyecto

🟢 Solo documentación. ☑ Corregido.

La fila 2 de [`docs/requisitos.md`](requisitos.md) decía
`flexion, extension, pronacion, supinacion, puno + reposo` — clases de un
proyecto de gestos de mano, no de coctelería. Quedaron de una versión anterior
del documento. Actualizada a las clases reales del Bartender.
