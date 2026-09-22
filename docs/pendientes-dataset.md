# Pendientes del dataset — hallazgos de la captura del 21-sep-2026

Revisión del export de Edge Impulse que está en
[`edge-impulse/dataset/`](../edge-impulse/dataset/) (60 tomas, Nano 33 BLE,
62,5 Hz, 9 ejes, 504,96 s).

> **Actualizado el 21-sep-2026 por la tarde.** Las 10 tomas de `remover` se
> regrabaron y se reemplazaron en el dataset; los notebooks 01, 02 y 03 están
> re-ejecutados sobre el dataset nuevo y los `.tflite` / `.h` regenerados.
> Cambian [D7](#d7--remover-no-tenia-movimiento-capturado) (cerrado) y
> [D4](#d4--duraciones-desparejas-entre-clases) (sigue parcial). El resto de
> hallazgos no se han tocado.

Cada hallazgo tiene su issue abierto en GitHub; la columna *Issue* enlaza.

**Entrega: martes 22-sep-2026, 18:30.** D-1 al escribir esto, así que la columna
*Bloquea* marca lo que impide entrenar hoy mismo.

| # | Hallazgo | Issue | Bloquea | Estado |
|---|---|:-:|:-:|:-:|
| [D1](#d1--las-etiquetas-del-export-vienen-por-toma) | Las etiquetas del export vienen por toma → 60 clases, no 6 | [#1](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/1) | 🔴 sí | ☑ mitigado |
| [D2](#d2--las-clases-capturadas-no-son-las-del-readme) | Las clases capturadas no son las del README: falta `colar`, sobra `reposo_mano` | [#2](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/2) | 🔴 sí | ☐ decisión del grupo |
| [D3](#d3--no-hay-particion-de-test) | No hay partición de test: las 60 tomas están en `training/` | [#3](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/3) | 🟡 no | ☐ |
| [D4](#d4--duraciones-desparejas-entre-clases) | Duraciones desparejas: `remover` 4 s vs 10 s del resto | [#4](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/4) | 🟡 no | ◪ parcial |
| [D5](#d5--el-magnetometro-sobra) | El magnetómetro (3 ejes `mag*`) sobra y puede meter sesgo de sitio | [#5](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/5) | 🟡 no | ☐ |
| [D6](#d6--requisitosmd-fila-2-lista-clases-de-otro-proyecto) | `docs/requisitos.md` fila 2 lista clases de otro proyecto | – | 🟢 doc | ☑ corregido |
| [D7](#d7--remover-no-tenia-movimiento-capturado) | `remover` no tenía movimiento capturado: `std_acc` 0,06, casi igual que `reposo` | – | 🔴 sí | ☑ regrabado el 21-sep |

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

🟡 No bloquea. ◪ **Parcialmente abierto tras la regrabación del 21-sep.**

Medido con el notebook [`01_datos_exploracion.ipynb`](../notebooks/01_datos_exploracion.ipynb)
re-ejecutado sobre el dataset actual (60 tomas, con `remover` ya regrabado):

| Clase | Tomas | Duración por toma | Total |
|---|--:|---|--:|
| `agitar` | 10 | 4 × 10,02 s + 6 × 4,02 s | 64,16 s |
| `macerar` | 10 | 10,02 s | 100,16 s |
| `remover` | 10 | **4,02 s** (las tomas nuevas también) | **40,16 s** |
| `reposo` | 10 | 10,02 s | 100,16 s |
| `reposo_mano` | 10 | 10,02 s | 100,16 s |
| `servir` | 10 | 10,02 s | 100,16 s |
| **total** | **60** | | **504,96 s** |

El número de ventanas sale proporcional a los **segundos**, no al número de
tomas. Con la configuración que usan los notebooks (**W = 125 muestras = 2,00 s,
paso = 25**):

| Clase | Ventanas | % del total | Veces menos que la mayor |
|---|--:|--:|--:|
| `agitar` | 120 | 11,8 % | 1,75× |
| `macerar` | 210 | 20,6 % | 1,00× |
| **`remover`** | **60** | **5,9 %** | **3,50×** |
| `reposo` | 210 | 20,6 % | 1,00× |
| `reposo_mano` | 210 | 20,6 % | 1,00× |
| `servir` | 210 | 20,6 % | 1,00× |
| **total** | **1020** | | |

**Estos números son idénticos a los de antes de regrabar**, y esa es
justamente la parte que sigue abierta: las 10 tomas nuevas de `remover` duran
4,016 s cada una, igual que las viejas, así que el desbalance **no se movió**.
Lo que sí se arregló con la regrabación es el contenido de la señal —
ver [D7](#d7--remover-no-tenia-movimiento-capturado).

**Efecto medido en el modelo, ahora que la señal es buena:** con
`class_weight` inverso a la frecuencia, el recall de `remover` en validación
cruzada agrupada es **1,00 en las dos vías** (era 0,90 en la B y 0,72 en la A).
O sea: con 60 ventanas basta **siempre que tengan movimiento dentro**. El
desbalance era el problema secundario; el principal era D7.

**Qué queda por hacer para cerrarlo:** volver a capturar `remover` con tomas de
10 s como el resto de clases (unos 60 s más de grabación) para que aporte ~210
ventanas. Mientras tanto se mitiga con `class_weight` y reportando matriz de
confusión y recall por clase, nunca solo la exactitud global.

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

---

## D7 — `remover` no tenía movimiento capturado

🔴 Bloqueaba la validez del modelo entregado. ☑ **Regrabado el 21-sep-2026.**

### El problema, como se midió

En [`notebooks/01_datos_exploracion.ipynb`](../notebooks/01_datos_exploracion.ipynb)
las 10 tomas originales de `remover` daban **`std_acc` ≈ 0,06** de mediana, del
mismo orden que `reposo` (≈ 0,03). Señal prácticamente plana: **no había
movimiento real capturado**, solo la coctelera quieta. Lo único que separaba
`remover` de `reposo` era el **vector gravedad medio**, es decir la
**orientación** en la que quedó la coctelera — no el gesto. El 0,90 de recall
que la Vía B sacaba sobre esa clase no medía el gesto, medía la postura.

### La regrabación

César volvió a grabar las 10 tomas con el gesto de cuchara realmente ejecutado.
Se reemplazaron los 10 `.cbor` viejos en
[`edge-impulse/dataset/training/`](../edge-impulse/dataset/training/) por los
nuevos, y se regeneró `info-6clases.labels` (el export nuevo volvía a traer
etiquetas por toma — `remover 1`, `remover 2`, `remover 3` ×8 — que es
[D1](#d1--las-etiquetas-del-export-vienen-por-toma) otra vez).

### Evidencia: `std_acc` por toma, viejas contra nuevas

Medido con `cbor2` sobre los archivos del repo — desviación estándar del módulo
de los 3 ejes del acelerómetro, una fila por toma:

| # | Toma vieja | `std_acc` | Toma nueva | `std_acc` |
|--:|---|--:|---|--:|
| 1 | `remover 01` | 0,082 | `remover 1.7305ko6p` | **1,316** |
| 2 | `remover 02` | 0,051 | `remover 2.7305l86l` | **0,623** |
| 3 | `remover 03` | 0,106 | `remover 3.7305llnq` | **0,584** |
| 4 | `remover 04` | 0,054 | `remover 3.7305mc6p` | **0,666** |
| 5 | `remover 05` | 0,067 | `remover 3.7305mou7` | **0,770** |
| 6 | `remover 06` | 0,032 | `remover 3.7305n4rv` | **0,828** |
| 7 | `remover 07` | 0,042 | `remover 3.7305nhpv` | **0,713** |
| 8 | `remover 08` | 0,042 | `remover 3.7305qk0p` | **0,526** |
| 9 | `remover 09` | 0,093 | `remover 3.7305r1c6` | **0,380** |
| 10 | `remover 10` | 0,066 | `remover 3.7305rk1j` | **0,457** |
| | **mediana** | **0,060** | | **0,645** |

Un orden de magnitud por encima, y por encima también de `servir` (0,244), que
es el gesto de movimiento con menos energía en acelerómetro. Para situarlo:

| Clase | `std_acc` (mediana) |
|---|--:|
| `agitar` | 7,004 |
| `macerar` | 3,273 |
| **`remover` (nuevo)** | **0,645** |
| `servir` | 0,244 |
| `reposo_mano` | 0,062 |
| `reposo` | 0,026 |
| | |
| *`remover` (viejo)* | *0,060* |

Segunda evidencia, independiente de la amplitud: la **frecuencia dominante** de
las tomas nuevas sale en **3,24 Hz con poca dispersión** (2,74–3,49 Hz entre
las 10 tomas). Un movimiento de cuchara periódico tiene un pico así; el ruido
de una señal plana no.

### Efecto en el modelo

Re-ejecutados los notebooks 02 y 03 sobre el dataset actualizado, mismo
pipeline (W=125, paso 25, solo acelerómetro, split por toma, CV agrupada de 5
pliegues, `class_weight`):

| | Antes (señal plana) | Después (regrabado) |
|---|--:|--:|
| Recall `remover`, Vía A (CV) | 0,72 | **1,00** |
| Recall `remover`, Vía B (CV) | 0,90 | **1,00** |
| Exactitud CV agrupada, Vía A | 0,927 ± 0,044 | **0,951 ± 0,031** |
| Exactitud CV agrupada, Vía B | 0,986 ± 0,011 | **0,987 ± 0,012** |

El recall de `remover` **no bajó: subió a 1,00 en las dos vías**, y ahora se
apoya en movimiento real, no en la orientación. El riesgo que este hallazgo
describía — que la predicción se cayera en cuanto el usuario sostuviera la
coctelera de otra forma — queda cerrado.

**Efecto lateral que hay que anotar:** con las tomas viejas, añadir el
giroscopio empeoraba la Vía B (0,986 → 0,968). Con las nuevas la **mejora**
(0,987 → 0,995 ± 0,005). La conclusión «giroscopio fuera» se sostiene todavía
en la Vía A (0,951 → 0,942), pero ya no en la B. Se entrega con 3 ejes y queda
anotado para después de la entrega — ver notebook 03, sección 11.

### Lo que la regrabación NO arregló

Las tomas nuevas **siguen durando 4,016 s**, igual que las viejas, así que
`remover` sigue aportando **60 de 1020 ventanas (5,9 %)** y
[D4](#d4--duraciones-desparejas-entre-clases) **sigue parcialmente abierto**.
Para cerrarlo hacen falta tomas de 10 s.
