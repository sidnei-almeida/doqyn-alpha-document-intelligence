#!/usr/bin/env bash
# Escala réplicas de auth-api e doqyn-api (Fase B.4).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"

# shellcheck source=lib/compose-production.sh
source "$SCRIPT_DIR/lib/compose-production.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}→${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }

compose() {
  compose_production "$DEPLOY_DIR" "$@"
}

read_replicas() {
  local name="$1"
  local default_value="$2"
  local raw="${!name:-$default_value}"
  if [[ ! "$raw" =~ ^[0-9]+$ ]] || [[ "$raw" -lt 1 ]]; then
    error "${name} inválido: ${raw} (use inteiro >= 1)"
    exit 1
  fi
  echo "$raw"
}

if [[ ! -f "$ENV_FILE" ]]; then
  error "deploy/.env não encontrado."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

cd "$DEPLOY_DIR"

AUTH_API_REPLICAS="$(read_replicas AUTH_API_REPLICAS 1)"
DOQYN_API_REPLICAS="$(read_replicas DOQYN_API_REPLICAS 1)"

info "Escalando auth-api → ${AUTH_API_REPLICAS} réplica(s)..."
compose up -d --no-recreate --scale "auth-api=${AUTH_API_REPLICAS}" auth-api

info "Escalando doqyn-api → ${DOQYN_API_REPLICAS} réplica(s)..."
compose up -d --no-recreate --scale "doqyn-api=${DOQYN_API_REPLICAS}" doqyn-api

info "Reiniciando nginx (upstream com DNS dinâmico)..."
compose up -d --no-recreate nginx

echo ""
compose ps auth-api doqyn-api nginx
