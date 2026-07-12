#!/usr/bin/env bash
# Sincroniza secrets de observabilidade (token Prometheus) e gera prometheus.generated.yml.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-$DEPLOY_DIR/.env}"
SECRETS_DIR="$DEPLOY_DIR/secrets"
TOKEN_FILE="$SECRETS_DIR/metrics_token"
BASE_CONFIG="$DEPLOY_DIR/observability/prometheus.yml"
OUT_CONFIG="$DEPLOY_DIR/observability/prometheus.generated.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo não encontrado: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

METRICS_TOKEN="${METRICS_TOKEN:-}"
if [[ -n "$METRICS_TOKEN" ]]; then
  printf '%s' "$METRICS_TOKEN" > "$TOKEN_FILE"
  cp "$BASE_CONFIG" "$OUT_CONFIG"
else
  : > "$TOKEN_FILE"
  # Sem token: remove bloco authorization (scrape interno sem Bearer).
  awk '
    /^    authorization:/ { skip=1; next }
    skip && /^      credentials_file:/ { skip=0; next }
    skip { next }
    { print }
  ' "$BASE_CONFIG" > "$OUT_CONFIG"
fi

chmod 600 "$TOKEN_FILE" "$OUT_CONFIG" 2>/dev/null || true

echo "Observabilidade: secrets sincronizados em deploy/secrets/ e prometheus.generated.yml"
