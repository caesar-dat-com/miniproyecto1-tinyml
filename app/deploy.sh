#!/usr/bin/env bash
# Despliega la app de captura en Ares. Idempotente.
set -euo pipefail

HOST="${MIXLAB_HOST:-ares@100.111.183.96}"
KEY="${MIXLAB_KEY:-$HOME/.ssh/id_ares_pi}"
DEST="${MIXLAB_DEST:-/home/ares/apps/mixlab}"

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Origen : $SRC"
echo "→ Destino: $HOST:$DEST"

ssh -i "$KEY" "$HOST" "mkdir -p '$DEST'"

rsync -az --delete \
  --exclude 'deploy.sh' \
  --exclude 'README.md' \
  -e "ssh -i $KEY" \
  "$SRC/" "$HOST:$DEST/"

cat <<'NOTA'
✓ Copiada.

Ruta en Caddy (una sola vez, dentro del bloque :9080 de /etc/caddy/Caddyfile):

    handle_path /mixlab/* {
        root * /home/ares/apps/mixlab
        header Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
        file_server
    }

    sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

Queda en https://ares-1.tailf26725.ts.net/mixlab/  ← HTTPS, o sea contexto
seguro: Web Bluetooth funciona desde el celular.

⚠ Para el camino WiFi (ws:// sin cifrar) esta URL NO sirve: una pagina HTTPS no
  puede abrir un WebSocket en claro. Ese camino va por HTTP local:
      cd app && python3 -m http.server 8080
NOTA
