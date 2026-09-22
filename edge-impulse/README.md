# Edge Impulse — dataset y proyecto

Enlace al proyecto público de Edge Impulse: _(pendiente)_

## `dataset/` — captura del 21-sep-2026

Exportación del proyecto `sebastian.santana / sebastian.santana-project-1`,
capturada por Sebastián con el IMU de bordo del Nano 33 BLE.

> **Las 10 tomas de `remover` son de una segunda captura**, del 21-sep por la
> tarde, hecha por César y exportada desde el proyecto
> `juan_c.diaz_r / juan_c.diaz_r-project-1`. Reemplazan a las originales, que no
> tenían movimiento real dentro
> ([D7](../docs/pendientes-dataset.md#d7--remover-no-tenia-movimiento-capturado)).
> Misma placa, misma frecuencia y mismos 9 ejes; se comprobó antes de integrarlas.
> `info.labels` en el repo es el del export original de Sebastián y **no
> describe estas 10 tomas**: el archivo bueno para subir es
> `info-6clases.labels`, que sí está regenerado con las 60 tomas actuales.

| Dato | Valor |
|---|---|
| Placa | `ARDUINO_NANO33BLE` (`6D:4A:AD:62:96:CB`) |
| Frecuencia | 62,5 Hz (`interval_ms = 16`) |
| Ejes | 9 — `accX/Y/Z` (m/s²), `gyrX/Y/Z` (°/s), `magX/Y/Z` (µT) |
| Tomas | 60, todas en `training/` (sin partición de test) |
| Duración total | 505 s ≈ 8 min 25 s |

### Tomas por clase

| Clase | Tomas | Duración por toma | Total |
|---|--:|---|--:|
| `agitar` | 10 | 4 tomas de 10 s + 6 de 4 s | 64,2 s |
| `macerar` | 10 | 10 s | 100,2 s |
| `remover` | 10 | 4 s (regrabadas) | 40,2 s |
| `reposo` | 10 | 10 s | 100,2 s |
| `reposo_mano` | 10 | 10 s | 100,2 s |
| `servir` | 10 | 10 s | 100,2 s |

## ⚠️ Pendientes antes de entrenar

El detalle de cada uno, con qué hay que decidir y qué comando correr, está en
[`docs/pendientes-dataset.md`](../docs/pendientes-dataset.md). Resumen:

| # | Hallazgo | Issue | Bloquea |
|---|---|:-:|:-:|
| [D1](../docs/pendientes-dataset.md#d1--las-etiquetas-del-export-vienen-por-toma) | Etiquetas por toma → 60 clases, no 6. Mitigado con `info-6clases.labels`, falta re-subir | [#1](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/1) | 🔴 |
| [D2](../docs/pendientes-dataset.md#d2--las-clases-capturadas-no-son-las-del-readme) | Falta `colar`, sobra `reposo_mano`. Solo hay 4 movimientos, el requisito pide 5 | [#2](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/2) | 🔴 |
| [D3](../docs/pendientes-dataset.md#d3--no-hay-particion-de-test) | Sin partición de test; el split por ventanas infla la accuracy | [#3](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/3) | 🟡 |
| [D4](../docs/pendientes-dataset.md#d4--duraciones-desparejas-entre-clases) | `remover` aporta 60 de 1020 ventanas (3,5× menos que `macerar`). **Sigue parcial:** las tomas regrabadas también son de 4 s | [#4](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/4) | 🟡 |
| [D5](../docs/pendientes-dataset.md#d5--el-magnetometro-sobra) | Dejar los 3 ejes `mag*` fuera del impulse | [#5](https://github.com/caesar-dat-com/miniproyecto1-tinyml/issues/5) | 🟡 |
| [D7](../docs/pendientes-dataset.md#d7--remover-no-tenia-movimiento-capturado) | `remover` no tenía movimiento capturado (`std_acc` 0,06). **☑ Regrabado el 21-sep**: `std_acc` 0,645 | – | ✅ |

Re-subida con las etiquetas corregidas:

```bash
cd edge-impulse/dataset
edge-impulse-uploader --clean --info-file info-6clases.labels
```
