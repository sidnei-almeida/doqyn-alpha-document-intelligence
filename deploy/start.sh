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

echo "→ Liberando porta 80 (nginx do Ubuntu, se existir)..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl stop nginx 2>/dev/null || true
  sudo systemctl disable nginx 2>/dev/null || true
  sudo systemctl mask nginx 2>/dev/null || true
fi

cd "$DEPLOY_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "→ Build (pode demorar na 1ª vez)..."
compose build

echo "→ Subindo bancos, Redis e auth..."
compose up -d postgres-auth mongo redis
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
