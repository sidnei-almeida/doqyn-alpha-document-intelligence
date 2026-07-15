#!/usr/bin/env bash
# Sobe a stack completa DOQYN em produção (Docker Compose).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

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

read_replicas() {
  local name="$1"
  local default_value="$2"
  local raw="${!name:-$default_value}"
  if [[ ! "$raw" =~ ^[0-9]+$ ]] || [[ "$raw" -lt 1 ]]; then
    error "${name} inválido em deploy/.env: ${raw} (use inteiro >= 1)"
    exit 1
  fi
  echo "$raw"
}

cd "$DEPLOY_DIR"

AUTH_API_REPLICAS="$(read_replicas AUTH_API_REPLICAS 1)"
DOQYN_API_REPLICAS="$(read_replicas DOQYN_API_REPLICAS 1)"

info "Réplicas configuradas: auth-api=${AUTH_API_REPLICAS}, doqyn-api=${DOQYN_API_REPLICAS}"

if [[ "${HTTP_PORT:-80}" == "80" ]]; then
  info "Preparando host Ubuntu (liberar porta 80 do nginx do sistema)..."
  if "$SCRIPT_DIR/run-prepare-ubuntu-host.sh"; then
    info "Porta 80 livre para o container nginx"
  else
    warn "Não foi possível liberar a porta 80 automaticamente."
    warn "Execute manualmente: sudo ./deploy/scripts/prepare-ubuntu-host.sh"
    warn "Diagnóstico: sudo ./deploy/scripts/prepare-ubuntu-host.sh --check"
  fi
fi

info "Construindo imagens (pode demorar na primeira vez)..."
compose build

info "Subindo PostgreSQL..."
compose up -d postgres-auth

info "Aplicando migrations do auth..."
compose run --rm auth-migrate

info "Subindo MongoDB e Redis..."
if is_mongodb_atlas_deploy; then
  info "MongoDB Atlas — sem container mongo local (${MONGODB_DATABASE:-})"
  compose up -d redis
else
  compose up -d mongo redis
fi

info "Subindo auth-api (${AUTH_API_REPLICAS} réplica(s))..."
compose up -d --scale "auth-api=${AUTH_API_REPLICAS}" --wait auth-api

info "Subindo API principal (${DOQYN_API_REPLICAS} réplica(s))..."
compose up -d --scale "doqyn-api=${DOQYN_API_REPLICAS}" --wait doqyn-api

info "Garantindo índices MongoDB..."
compose run --rm doqyn-api-indexes || warn "Índices MongoDB: verifique logs (normal se ainda não há tenants)."

info "Subindo worker de análise (fila BullMQ)..."
compose up -d doqyn-worker

info "Subindo worker de preview (Ghostscript)..."
compose up -d doqyn-worker-preview

info "Subindo nginx (SPA + proxy)..."
compose up -d --wait nginx

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

DEEP_JSON="$(curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health/deep" 2>/dev/null || true)"
if [[ -n "$DEEP_JSON" ]]; then
  DEEP_STATUS="$(printf '%s' "$DEEP_JSON" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
  if [[ "$DEEP_STATUS" == "ok" ]]; then
    info "Deep health OK"
  else
    warn "Deep health: ${DEEP_STATUS:-unknown} — verifique redis, worker e storage"
  fi
else
  warn "Deep health ainda não respondeu — veja: compose logs doqyn-api"
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

if [[ "${OBSERVABILITY_ENABLE:-false}" == "true" ]]; then
  info "OBSERVABILITY_ENABLE=true — subindo Prometheus e Grafana..."
  "$SCRIPT_DIR/up-observability.sh"
else
  echo "  Observabilidade (opcional): ./deploy/scripts/up-observability.sh"
fi

echo ""
warn "HTTPS: este compose expõe porta ${HTTP_PORT} (HTTP). Use Certbot/Nginx no host ou Cloudflare para TLS."
echo "Validação pré-deploy: ./deploy/scripts/validate-vps-ready.sh"
echo "Guia completo: docs/DEPLOY_VPS.md"
