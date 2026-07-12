#!/usr/bin/env bash
# Sobe Prometheus + Grafana + redis-exporter (profile observability).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
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

if [[ ! -f "$ENV_FILE" ]]; then
  error "deploy/.env não encontrado. Execute: ./deploy/scripts/setup-production-env.sh"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]]; then
  error "GRAFANA_ADMIN_PASSWORD não definido em deploy/.env"
  exit 1
fi

if [[ -z "${METRICS_TOKEN:-}" ]]; then
  warn "METRICS_TOKEN vazio — scrape da API sem Bearer (ok em rede Docker fechada)"
fi

"$SCRIPT_DIR/sync-observability-secrets.sh" "$ENV_FILE"

cd "$DEPLOY_DIR"

info "Subindo redis-exporter, Prometheus e Grafana..."
compose_production_observability "$DEPLOY_DIR" up -d redis-exporter prometheus grafana

sleep 3

PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
GRAFANA_PORT="${GRAFANA_PORT:-3000}"

if curl -fsS "http://127.0.0.1:${PROMETHEUS_PORT}/-/ready" >/dev/null 2>&1; then
  info "Prometheus OK: http://127.0.0.1:${PROMETHEUS_PORT} (apenas localhost)"
else
  warn "Prometheus ainda não respondeu — veja: compose logs prometheus"
fi

if curl -fsS "http://127.0.0.1:${GRAFANA_PORT}/api/health" >/dev/null 2>&1; then
  info "Grafana OK: http://127.0.0.1:${GRAFANA_PORT} (apenas localhost)"
else
  warn "Grafana ainda não respondeu — veja: compose logs grafana"
fi

echo ""
info "Acesso remoto: use túnel SSH, ex.:"
echo "  ssh -L ${GRAFANA_PORT}:127.0.0.1:${GRAFANA_PORT} -L ${PROMETHEUS_PORT}:127.0.0.1:${PROMETHEUS_PORT} user@vps"
echo ""
echo "  Grafana: admin / (senha em GRAFANA_ADMIN_PASSWORD no deploy/.env)"
echo "  Dashboard: DOQYN — Overview"
echo "  Alertas: Prometheus → Alerts (doqyn-production)"
