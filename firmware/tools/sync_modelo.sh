#!/usr/bin/env bash
# ============================================================================
# sync_modelo.sh — trae el modelo entrenado al sketch de inferencia
#
# El notebook 03 (notebooks/03_entrenamiento_B_conv1d.ipynb) escribe
# notebooks/via_b_int8.h con TODO lo que el firmware necesita:
#   - modelo_via_b[] / modelo_via_b_len   el .tflite int8 como array
#   - MEDIA[3] / DESV[3]                  normalización del StandardScaler
#   - VENTANA / N_EJES                    forma de la ventana
#   - CLASES_C[]                          etiquetas, en el orden del modelo
#
# Este script lo copia a firmware/nano33ble_mixlab_inferencia/modelo_via_b.h
# y verifica que no falte nada. Después de un reentreno, ejecutarlo y volver
# a compilar: en el .ino no hay que tocar una sola constante.
#
#   ./firmware/tools/sync_modelo.sh
# ============================================================================
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
origen="$raiz/notebooks/via_b_int8.h"
destino="$raiz/firmware/nano33ble_mixlab_inferencia/modelo_via_b.h"

if [[ ! -f "$origen" ]]; then
  echo "No existe $origen"
  echo "Corre primero el notebook 03_entrenamiento_B_conv1d.ipynb."
  exit 1
fi

# Sin estos símbolos el sketch no compila: mejor fallar aquí y decir cuál falta
# que dejar que el compilador escupa cien líneas de plantillas.
faltan=()
for simbolo in modelo_via_b modelo_via_b_len MEDIA DESV VENTANA N_EJES CLASES_C; do
  grep -q "\b$simbolo\b" "$origen" || faltan+=("$simbolo")
done

if (( ${#faltan[@]} )); then
  echo "A $origen le faltan símbolos: ${faltan[*]}"
  echo "El notebook 03 debe emitirlos al final del .h."
  exit 1
fi

if [[ -f "$destino" ]] && cmp -s "$origen" "$destino"; then
  echo "Ya estaba al día: $destino"
else
  cp "$origen" "$destino"
  echo "Copiado: $origen"
  echo "      -> $destino"
fi

echo
echo "Constantes que va a usar el firmware:"
grep -E "^(const (float|int|char)|const unsigned int)" "$destino" | sed 's/^/  /'
echo
echo "Ahora compila:"
echo "  arduino-cli compile -b arduino:mbed_nano:nano33ble firmware/nano33ble_mixlab_inferencia"
