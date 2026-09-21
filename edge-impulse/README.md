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

1. **Las etiquetas del export vienen rotas.** En `info.labels` cada toma lleva su
   propio nombre como etiqueta (`Agitar 01`, `Agitar 02`, …), así que el proyecto
   tiene **60 clases de una toma cada una**, no 6. Entrenar así no sirve.
   Se deja el export original intacto y, al lado, `info-6clases.labels` con las
   etiquetas ya normalizadas (minúsculas, sin número, espacios a `_`):

   ```bash
   cd edge-impulse/dataset
   edge-impulse-uploader --clean --info-file info-6clases.labels
   ```

2. **Las clases no son las del README.** Falta `colar` y sobra `reposo_mano`.
   Hay que decidir si `colar` se captura o se quita del alcance, y si
   `reposo_mano` (mano sosteniendo la coctelera quieta) es una clase propia o
   tomas extra de `reposo`.

3. **Sin datos de test.** Las 60 tomas están en `training/`. Edge Impulse puede
   separarlas, pero conviene capturar test aparte para que no queden ventanas del
   mismo movimiento a los dos lados de la partición.

4. **Duraciones desparejas.** `remover` son 4 s por toma y `macerar`/`reposo`/
   `servir` son 10 s; `agitar` mezcla las dos. Con ventanas de 1–2 s el número de
   ventanas por clase queda desbalanceado (`remover` aporta ~2,5× menos que
   `macerar`). O se iguala la duración capturando más `remover`, o se compensa con
   el balanceo del bloque de ventaneo.

5. **El magnetómetro probablemente sobra.** Las 3 columnas `mag*` dependen de la
   orientación respecto al norte y del entorno metálico; el plan del proyecto
   habla de acelerómetro + giroscopio. Dejarlas fuera del *impulse* baja el tamaño
   del modelo y evita que aprenda de dónde se grabó.
