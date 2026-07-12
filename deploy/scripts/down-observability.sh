#!/usr/bin/env bash
# Para Prometheus + Grafana + redis-exporter (mantém a stack principal).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

# shellcheck source=lib/compose-production.sh
source "$SCRIPT_DIR/lib/compose-production.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

info() { echo -e "${GREEN}→${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }

if [[ ! -f "$ENV_FILE" ]]; then
  error "deploy/.env não encontrado."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

cd "$DEPLOY_DIR"

info "Parando observabilidade (redis-exporter, prometheus, grafana)..."
compose_production_observability "$DEPLOY_DIR" stop redis-exporter prometheus grafana

info "Observabilidade parada. Stack principal (API, workers, nginx) inalterada."
