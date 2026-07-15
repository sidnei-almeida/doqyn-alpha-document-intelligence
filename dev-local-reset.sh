#!/usr/bin/env bash
# Dev local do alpha: sobe o MongoDB (Docker), reseta o banco, recria os
# índices, aplica o seed demo e inicia API+Vite — tudo em um comando.
#
# Pré-requisito: rode primeiro o dev-local-reset.sh do doqyn-auth-service
# (o seed demo daqui depende do manifest gerado por ele).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

STARTED_MONGO=false

cleanup() {
  if [[ "$STARTED_MONGO" == true ]]; then
    echo "→ Parando mongo (subido por este script)..."
    docker compose -f deploy/docker-compose.dev.yml stop mongo || true
  fi
}
trap cleanup EXIT INT TERM

MANIFEST="../doqyn-auth-service/.generated/doqyn-demo-seed-manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERRO: manifest do auth-service não encontrado em $MANIFEST."
  echo "Rode primeiro o dev-local-reset.sh do doqyn-auth-service (ele gera esse manifest)."
  exit 1
fi

MONGO_URI_LINE="$(grep -m1 '^MONGODB_URI=' .env 2>/dev/null || true)"
MONGO_URI_VALUE="${MONGO_URI_LINE#MONGODB_URI=}"
MONGO_URI_VALUE="${MONGO_URI_VALUE%\"}"; MONGO_URI_VALUE="${MONGO_URI_VALUE#\"}"
MONGO_URI_VALUE="${MONGO_URI_VALUE%\'}"; MONGO_URI_VALUE="${MONGO_URI_VALUE#\'}"

IS_LOCAL_MONGO=false
if [[ "$MONGO_URI_VALUE" == mongodb://localhost:* || "$MONGO_URI_VALUE" == mongodb://127.0.0.1:* ]]; then
  IS_LOCAL_MONGO=true
fi

if [[ "$IS_LOCAL_MONGO" == true ]]; then
  echo "→ Verificando mongo..."
  RUNNING="$(docker compose -f deploy/docker-compose.dev.yml ps --status running -q mongo 2>/dev/null || true)"
  if [[ -z "$RUNNING" ]]; then
    echo "→ Subindo mongo..."
    docker compose -f deploy/docker-compose.dev.yml up -d --wait mongo
    STARTED_MONGO=true
  else
    echo "→ mongo já está rodando."
  fi
else
  echo "→ MONGODB_URI aponta para host remoto (Atlas) — pulando container mongo local."
fi

echo "→ Reset do MongoDB (destrutivo, ambiente dev)..."
npm run dev:reset:mongo -- --confirm-reset-doqyn-dev

echo "→ Recriando índices/collections..."
npm run db:setup

echo "→ Seed demo..."
npm run dev:seed:demo

echo "→ Subindo alpha (API 3001 + Vite 5173)..."
exec npm run dev
