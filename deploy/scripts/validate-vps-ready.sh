#!/usr/bin/env bash
# Valida se o deploy está pronto para VPS (env, compose, secrets, health opcional).
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

ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*" >&2; ERRORS=$((ERRORS + 1)); }

ERRORS=0

require_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    fail "Variável ausente em deploy/.env: $name"
  else
    ok "$name definido"
  fi
}

info_section() {
  echo ""
  echo "== $1 =="
}

info_section "Arquivos e repositórios"

if [[ -f "$ENV_FILE" ]]; then
  ok "deploy/.env existe"
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  fail "deploy/.env ausente — rode ./deploy/scripts/setup-production-env.sh"
fi

AUTH_SERVICE_DIR="${AUTH_SERVICE_DIR:-$(dirname "$PROJECT_ROOT")/doqyn-auth-service}"
if [[ -d "$AUTH_SERVICE_DIR" ]]; then
  ok "auth-service em $AUTH_SERVICE_DIR"
else
  fail "auth-service não encontrado: $AUTH_SERVICE_DIR"
fi

for rel in docker-compose.production.yml scripts/deploy-production.sh scripts/scale-api-replicas.sh scripts/sync-mongodb-indexes.sh scripts/lib/compose-production.sh nginx/default.conf scripts/validate-vps-ready.sh; do
  if [[ -f "$DEPLOY_DIR/$rel" ]]; then
    ok "$rel"
  else
    fail "Arquivo ausente: deploy/$rel"
  fi
done

info_section "Variáveis críticas (Fase A)"

if [[ -f "$ENV_FILE" ]]; then
  require_var POSTGRES_PASSWORD
  require_var MONGODB_URI
  require_var MONGODB_DATABASE

  if [[ "${MONGODB_USE_ATLAS:-false}" == "true" ]]; then
    ok "MONGODB_USE_ATLAS=true"
    if [[ "${MONGODB_URI}" == mongodb+srv://* ]]; then
      ok "MONGODB_URI Atlas (SRV)"
    else
      warn "MONGODB_USE_ATLAS=true mas URI não é mongodb+srv://"
    fi
    warn "Atlas: libere o IP da VPS em Network Access (allowlist) antes do deploy"
  else
    ok "MONGODB_USE_ATLAS=false (container mongo via profile local-mongo)"
    if [[ "${MONGODB_URI}" == mongodb://mongo:* ]]; then
      ok "MONGODB_URI aponta para container mongo"
    else
      warn "MONGODB_URI não usa host mongo — confira se é intencional"
    fi
  fi
  require_var GROQ_API_KEY
  require_var R2_ACCESS_KEY_ID
  require_var R2_SECRET_ACCESS_KEY
  require_var DOQYN_INTERNAL_API_KEY
  require_var DATA_ENCRYPTION_KEY

  if [[ "${REDIS_ENABLED:-}" == "true" ]]; then
    ok "REDIS_ENABLED=true"
  else
    warn "REDIS_ENABLED não é true — fila e cache desativados"
  fi

  if [[ "${ANALYSIS_SYNC_FALLBACK:-}" == "false" ]]; then
    ok "ANALYSIS_SYNC_FALLBACK=false (fila assíncrona)"
  else
    warn "ANALYSIS_SYNC_FALLBACK não é false"
  fi
fi

info_section "Réplicas (Fase B.4)"

if [[ -f "$ENV_FILE" ]]; then
  for name in AUTH_API_REPLICAS DOQYN_API_REPLICAS; do
    raw="${!name:-}"
    if [[ "$raw" =~ ^[0-9]+$ ]] && [[ "$raw" -ge 1 ]]; then
      ok "${name}=${raw}"
    else
      fail "${name} inválido ou ausente (use inteiro >= 1)"
    fi
  done

  if [[ -f "$DEPLOY_DIR/nginx/default.conf" ]]; then
    if grep -q 'least_conn' "$DEPLOY_DIR/nginx/default.conf" && grep -q '127.0.0.11' "$DEPLOY_DIR/nginx/default.conf"; then
      ok "nginx configurado para balanceamento dinâmico"
    else
      fail "nginx/default.conf sem least_conn ou resolver Docker"
    fi
  fi
fi

info_section "Observabilidade"

if [[ -f "$ENV_FILE" ]]; then
  if [[ "${OBSERVABILITY_ENABLE:-false}" == "true" ]]; then
    ok "OBSERVABILITY_ENABLE=true"
    require_var METRICS_TOKEN
    require_var GRAFANA_ADMIN_PASSWORD
  else
    warn "OBSERVABILITY_ENABLE não é true — Prometheus/Grafana não sobem no deploy automático"
    if [[ -n "${METRICS_TOKEN:-}" ]]; then
      ok "METRICS_TOKEN definido"
    else
      warn "METRICS_TOKEN vazio — gere com setup-production-env.sh"
    fi
    if [[ -n "${GRAFANA_ADMIN_PASSWORD:-}" ]]; then
      ok "GRAFANA_ADMIN_PASSWORD definido"
    else
      warn "GRAFANA_ADMIN_PASSWORD ausente — necessário para Grafana"
    fi
  fi

  for rel in scripts/up-observability.sh scripts/down-observability.sh observability/prometheus.yml observability/alerts/doqyn-alerts.yml; do
    if [[ -f "$DEPLOY_DIR/$rel" ]]; then
      ok "$rel"
    else
      fail "Arquivo ausente: deploy/$rel"
    fi
  done

  if [[ -f "$DEPLOY_DIR/observability/prometheus.generated.yml" ]]; then
    ok "prometheus.generated.yml"
  elif [[ -f "$ENV_FILE" ]]; then
    "$SCRIPT_DIR/sync-observability-secrets.sh" "$ENV_FILE" >/dev/null
    ok "prometheus.generated.yml gerado via sync"
  else
    fail "prometheus.generated.yml ausente"
  fi

  if [[ -f "$DEPLOY_DIR/nginx/default.conf" ]] && grep -q '/api/metrics' "$DEPLOY_DIR/nginx/default.conf"; then
    if grep -q 'return 403' "$DEPLOY_DIR/nginx/default.conf"; then
      ok "/api/metrics bloqueado no nginx"
    else
      warn "nginx não bloqueia /api/metrics publicamente"
    fi
  fi
fi

info_section "Docker Compose"

cd "$DEPLOY_DIR"
# shellcheck source=scripts/lib/compose-production.sh
source "$SCRIPT_DIR/lib/compose-production.sh"

if docker compose version >/dev/null 2>&1; then
  if compose_production "$DEPLOY_DIR" config >/dev/null 2>&1; then
    ok "docker compose config (stack principal)"
  else
    fail "docker compose config inválido — verifique deploy/.env"
  fi
  local_mongo_profile=()
  if [[ "${MONGODB_USE_ATLAS:-false}" != "true" ]]; then
    local_mongo_profile=(--profile local-mongo)
  fi
  if docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" --profile observability "${local_mongo_profile[@]}" config >/dev/null 2>&1; then
    ok "docker compose config (profile observability)"
  else
    fail "profile observability inválido — defina GRAFANA_ADMIN_PASSWORD"
  fi
else
  warn "docker compose não disponível neste host — pulando validação compose"
fi

info_section "Health (opcional — se stack já estiver rodando)"

HTTP_PORT="${HTTP_PORT:-80}"
if curl -fsS --max-time 3 "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1; then
  ok "GET /api/health"
  if curl -fsS --max-time 5 "http://127.0.0.1:${HTTP_PORT}/api/health/deep" | grep -q '"status":"ok"'; then
    ok "GET /api/health/deep (ok)"
  else
    warn "deep health não está ok — verifique redis/worker/storage"
  fi
  METRICS_HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${HTTP_PORT}/api/metrics" || echo 000)"
  if [[ "$METRICS_HTTP" == "403" ]]; then
    ok "/api/metrics bloqueado no nginx (403)"
  else
    warn "/api/metrics retornou HTTP $METRICS_HTTP (esperado 403 via nginx)"
  fi
else
  warn "Stack não está rodando localmente — health checks ignorados"
fi

echo ""
if [[ "$ERRORS" -gt 0 ]]; then
  fail "Validação falhou com $ERRORS erro(s)"
  exit 1
fi

ok "Pronto para deploy na VPS"
echo ""
echo "Próximos passos na VPS:"
echo "  1. ./deploy/scripts/setup-production-env.sh   (se ainda não tiver .env)"
echo "  2. ./deploy/scripts/deploy-production.sh"
echo "  3. ./deploy/scripts/up-observability.sh       (opcional)"
