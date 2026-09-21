# Edge Impulse — dataset y proyecto

Enlace al proyecto público de Edge Impulse: _(pendiente)_

## `dataset/` — captura del 21-sep-2026

Exportación del proyecto `sebastian.santana / sebastian.santana-project-1`,
capturada por Sebastián con el IMU de bordo del Nano 33 BLE.

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
| `remover` | 10 | 4 s | 40,2 s |
| `reposo` | 10 | 10 s | 100,2 s |
| `reposo_mano` | 10 | 10 s | 100,2 s |
| `servir` | 10 | 10 s | 100,2 s |

## ⚠️ Pendientes antes de entrenar

El detalle de cada uno, con qué hay que decidir y qué comando correr, está en
[`docs/pendientes-dataset.md`](../docs/pendientes-dataset.md). Resumen:

| # | Hallazgo | Bloquea |
|---|---|:-:|
| [D1](../docs/pendientes-dataset.md#d1--las-etiquetas-del-export-vienen-por-toma) | Etiquetas por toma → 60 clases, no 6. Mitigado con `info-6clases.labels`, falta re-subir | 🔴 |
| [D2](../docs/pendientes-dataset.md#d2--las-clases-capturadas-no-son-las-del-readme) | Falta `colar`, sobra `reposo_mano`. Solo hay 4 movimientos, el requisito pide 5 | 🔴 |
| [D3](../docs/pendientes-dataset.md#d3--no-hay-particion-de-test) | Sin partición de test; el split por ventanas infla la accuracy | 🟡 |
| [D4](../docs/pendientes-dataset.md#d4--duraciones-desparejas-entre-clases) | `remover` aporta ~2,5× menos ventanas que `macerar` | 🟡 |
| [D5](../docs/pendientes-dataset.md#d5--el-magnetometro-sobra) | Dejar los 3 ejes `mag*` fuera del impulse | 🟡 |

Re-subida con las etiquetas corregidas:

```bash
cd edge-impulse/dataset
edge-impulse-uploader --clean --info-file info-6clases.labels
```
