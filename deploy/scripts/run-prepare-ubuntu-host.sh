#!/usr/bin/env bash
# Chama prepare-ubuntu-host.sh com sudo quando necessário.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREPARE="$SCRIPT_DIR/prepare-ubuntu-host.sh"

if [[ ! -x "$PREPARE" ]]; then
  chmod +x "$PREPARE"
fi

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  exec "$PREPARE" "$@"
fi

if command -v sudo >/dev/null 2>&1; then
  exec sudo "$PREPARE" "$@"
fi

echo "prepare-ubuntu-host requer root. Execute: sudo $PREPARE" >&2
exit 1
