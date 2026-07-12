#!/usr/bin/env bash
# Aplica índices MongoDB (local Docker ou Atlas) via container one-shot.
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

if is_mongodb_atlas_deploy; then
  info "Sincronizando índices no MongoDB Atlas (${MONGODB_DATABASE:-})..."
else
  info "Sincronizando índices no MongoDB local..."
  compose_production "$DEPLOY_DIR" up -d mongo
fi

compose_production "$DEPLOY_DIR" run --rm doqyn-api-indexes

info "Índices MongoDB aplicados."
