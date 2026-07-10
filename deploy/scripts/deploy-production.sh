#!/usr/bin/env bash
# Sobe a stack completa DOQYN em produção (Docker Compose).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}→${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  else
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  error "Arquivo deploy/.env não encontrado."
  echo "Execute primeiro: ./deploy/scripts/setup-production-env.sh"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

AUTH_SERVICE_DIR="${AUTH_SERVICE_DIR:-$(dirname "$PROJECT_ROOT")/doqyn-auth-service}"
if [[ ! -d "$AUTH_SERVICE_DIR" ]]; then
  error "auth-service não encontrado: $AUTH_SERVICE_DIR"
  exit 1
fi

export AUTH_SERVICE_DIR

cd "$DEPLOY_DIR"

info "Construindo imagens (pode demorar na primeira vez)..."
compose build

info "Subindo PostgreSQL..."
compose up -d postgres-auth

info "Aplicando migrations do auth..."
compose run --rm auth-migrate

info "Subindo MongoDB..."
compose up -d mongo

info "Subindo auth-api..."
compose up -d --wait auth-api

info "Subindo API principal..."
compose up -d --wait doqyn-api

info "Garantindo índices MongoDB..."
compose run --rm doqyn-api-indexes || warn "Índices MongoDB: verifique logs (normal se ainda não há tenants)."

info "Subindo frontend e nginx..."
compose up -d --wait doqyn-web nginx

sleep 2

HTTP_PORT="${HTTP_PORT:-80}"
PUBLIC_URL="${DOQYN_PUBLIC_APP_URL:-http://localhost:${HTTP_PORT}}"

if curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null; then
  info "API OK: http://127.0.0.1:${HTTP_PORT}/api/health"
else
  warn "Health da API ainda não respondeu — veja: compose logs doqyn-api"
fi

if curl -fsS "http://127.0.0.1:${HTTP_PORT}/health" >/dev/null; then
  info "Auth OK: http://127.0.0.1:${HTTP_PORT}/health"
else
  warn "Health do auth ainda não respondeu — veja: compose logs auth-api"
fi

echo ""
info "Status dos containers:"
compose ps

echo ""
info "Deploy concluído."
echo ""
echo "  App:  ${PUBLIC_URL}"
echo "  Logs: cd deploy && docker compose -f docker-compose.production.yml --env-file .env logs -f"
echo ""
warn "HTTPS: este compose expõe porta ${HTTP_PORT} (HTTP). Use Certbot/Nginx no host ou Cloudflare para TLS."
echo "Guia completo: docs/DEPLOY_VPS.md"
