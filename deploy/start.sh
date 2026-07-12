#!/usr/bin/env bash
# Sobe o DOQYN na VPS — um comando só.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo deploy/.env não existe."
  echo "Execute: ./deploy/scripts/setup-production-env.sh"
  echo "Ou copie: cp deploy/env/.env.production.example deploy/.env"
  echo "Edite as senhas: nano deploy/.env"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"
# shellcheck source=scripts/lib/compose-production.sh
source "$DEPLOY_DIR/scripts/lib/compose-production.sh"

echo "→ Preparando host Ubuntu (porta 80)..."
"$DEPLOY_DIR/scripts/run-prepare-ubuntu-host.sh" || {
  echo "! Não liberou a porta 80 — tente: sudo ./deploy/scripts/prepare-ubuntu-host.sh --check"
}

cd "$DEPLOY_DIR"

compose() {
  compose_production "$DEPLOY_DIR" "$@"
}

echo "→ Build (pode demorar na 1ª vez)..."
compose build

echo "→ Subindo bancos, Redis e auth..."
if is_mongodb_atlas_deploy; then
  echo "→ MongoDB Atlas (${MONGODB_DATABASE:-}) — sem container mongo"
  compose up -d postgres-auth redis
else
  compose up -d postgres-auth mongo redis
fi
compose run --rm auth-migrate
compose up -d --wait auth-api

echo "→ Subindo API e worker de análise..."
compose up -d --wait doqyn-api
compose run --rm doqyn-api-indexes || true
compose up -d doqyn-worker

echo "→ Subindo site (nginx único)..."
compose up -d --wait nginx

echo ""
echo "✓ Pronto."
compose ps
echo ""

HTTP_PORT="${HTTP_PORT:-80}"
if curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1; then
  echo "✓ API: http://127.0.0.1:${HTTP_PORT}/api/health"
else
  echo "! API ainda não respondeu — veja: compose logs doqyn-api"
fi

DEEP_STATUS="$(curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health/deep" 2>/dev/null | sed -n 's/.*"status":"\([^"]*\)".*/\1/p' || true)"
if [[ -n "$DEEP_STATUS" ]]; then
  echo "✓ Deep health: ${DEEP_STATUS}"
else
  echo "! Deep health ainda não respondeu — veja: compose logs doqyn-api redis doqyn-worker"
fi

echo ""
echo "Abra no navegador: http://$(curl -fsS ifconfig.me 2>/dev/null || echo SEU_IP)"
