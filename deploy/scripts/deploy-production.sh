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

# Checado aqui e não só no validador porque SKIP_VALIDATION=1 pula aquele caminho,
# e sem esta variável o compose do nginx nem interpola o certificado.
if [[ -z "${LETSENCRYPT_DOMAIN:-}" ]]; then
  error "LETSENCRYPT_DOMAIN ausente em deploy/.env — o nginx não sobe sem TLS."
  echo "Defina o domínio público (ex.: LETSENCRYPT_DOMAIN=app.doqyn.com) e rode de novo."
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

# Validação na entrada: erro de .env (URL sem https, chaves internas fora de
# sincronia, teto de memória acima da RAM) aparece antes do build, não depois de
# 20 minutos compilando. SKIP_VALIDATION=1 para pular num redeploy consciente.
if [[ "${SKIP_VALIDATION:-0}" != "1" ]]; then
  info "Validando configuração antes de construir..."
  if ! "$SCRIPT_DIR/validate-vps-ready.sh"; then
    error "Validação falhou — corrija deploy/.env e rode de novo."
    echo "Para ignorar (não recomendado): SKIP_VALIDATION=1 $0"
    exit 1
  fi
fi

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

# Antes do nginx: ele aponta ssl_certificate para o arquivo do Let's Encrypt e se
# recusa a subir se não existir. O script é idempotente — se o certificado já está
# no volume, sai na hora sem falar com o Let's Encrypt.
info "Garantindo certificado TLS de ${LETSENCRYPT_DOMAIN:-<sem domínio>}..."
if ! "$SCRIPT_DIR/issue-tls-cert.sh"; then
  error "Não foi possível emitir o certificado TLS — o nginx não sobe sem ele."
  echo "Diagnóstico: ./deploy/scripts/issue-tls-cert.sh --staging"
  exit 1
fi

info "Subindo nginx (SPA + proxy + TLS)..."
compose up -d --wait nginx

info "Subindo certbot (renovação automática)..."
compose up -d certbot

HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
PUBLIC_URL="${DOQYN_PUBLIC_APP_URL:-https://${LETSENCRYPT_DOMAIN:-localhost}}"

# Verificação por HTTPS resolvendo o domínio no loopback: valida de uma vez o
# listener 443, o certificado e o roteamento, sem depender de sair para a internet
# e voltar. Em http a app não responde mais nada além do redirect.
BASE="https://${LETSENCRYPT_DOMAIN}"
if [[ "$HTTPS_PORT" != "443" ]]; then
  BASE="https://${LETSENCRYPT_DOMAIN}:${HTTPS_PORT}"
fi
CURL_RESOLVE=(--resolve "${LETSENCRYPT_DOMAIN}:${HTTPS_PORT}:127.0.0.1")

echo ""
info "Verificando o serviço (o deploy só termina se isto passar)..."

DEPLOY_FAILED=0
step_fail() {
  error "$1"
  echo "    $2"
  DEPLOY_FAILED=1
}

# Espera o nginx passar a atender de fato. `--wait` garante container saudável,
# não que a rota pública responda.
wait_for() {
  local url="$1"
  local tries="${2:-30}"
  local i
  for ((i = 0; i < tries; i++)); do
    if curl -fsS "${CURL_RESOLVE[@]}" --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if wait_for "${BASE}/api/health" 45; then
  info "API responde em ${BASE}/api/health"
else
  step_fail "API não respondeu em 90s." "Diagnóstico: compose logs doqyn-api"
fi

if wait_for "${BASE}/health" 15; then
  info "Auth responde em ${BASE}/health"
else
  step_fail "Auth não respondeu." "Diagnóstico: compose logs auth-api postgres-auth pgbouncer"
fi

# O buraco de verificação que interessa: o IP pode responder 200 servindo a
# página default do nginx (do host ou de uma imagem velha) em vez da SPA. Testar
# só o status code não distingue os dois casos.
ROOT_BODY="$(curl -fsS "${CURL_RESOLVE[@]}" --max-time 10 "${BASE}/" 2>/dev/null || true)"
if [[ -z "$ROOT_BODY" ]]; then
  step_fail "A raiz (${BASE}/) não respondeu." "Diagnóstico: compose logs nginx"
elif printf '%s' "$ROOT_BODY" | grep -qi 'Welcome to nginx'; then
  step_fail "A raiz devolveu a página default do nginx, não o DOQYN." \
    "O nginx do host ainda ocupa a porta ${HTTP_PORT}: sudo ./deploy/scripts/prepare-ubuntu-host.sh"
elif printf '%s' "$ROOT_BODY" | grep -q 'id="root"'; then
  info "Frontend servido pelo container (SPA encontrada na raiz)"
else
  step_fail "A raiz respondeu, mas o conteúdo não é a SPA do DOQYN." \
    "Reconstrua o frontend: compose build --no-cache nginx && compose up -d nginx"
fi

DEEP_JSON="$(curl -fsS "${CURL_RESOLVE[@]}" --max-time 10 "${BASE}/api/health/deep" 2>/dev/null || true)"
DEEP_STATUS="$(printf '%s' "$DEEP_JSON" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
case "$DEEP_STATUS" in
  ok)
    info "Deep health OK (mongo, redis, fila, auth, storage)"
    ;;
  degraded)
    warn "Deep health: degraded — a app sobe, mas algo está fora do ar."
    printf '%s' "$DEEP_JSON" | tr ',' '\n' | grep -i '"ok":false' >/dev/null 2>&1 \
      && echo "    Detalhe: curl -s ${BASE}/api/health/deep"
    ;;
  *)
    step_fail "Deep health não respondeu ou está down (${DEEP_STATUS:-sem resposta})." \
      "Diagnóstico: compose logs doqyn-api redis"
    ;;
esac

# A porta 80 não serve mais a app: só ACME e redirect. Se ela voltar a responder
# 200, alguma conf velha sobreviveu e o tráfego seguiria em texto claro.
REDIRECT_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${HTTP_PORT}/" || echo 000)"
if [[ "$REDIRECT_CODE" == "301" ]]; then
  info "Porta ${HTTP_PORT} redireciona para HTTPS (301)"
else
  step_fail "Porta ${HTTP_PORT} devolveu HTTP ${REDIRECT_CODE}, esperado 301." \
    "Conf antiga no container: compose build --no-cache nginx && compose up -d nginx"
fi

# Container que morreu depois de subir não aparece no --wait.
STOPPED="$(compose ps --status exited --status dead --format '{{.Service}}' 2>/dev/null \
  | grep -v -E '^(auth-migrate|doqyn-api-indexes)$' || true)"
if [[ -n "$STOPPED" ]]; then
  step_fail "Containers parados: $(printf '%s' "$STOPPED" | tr '\n' ' ')" \
    "Diagnóstico: compose logs $(printf '%s' "$STOPPED" | tr '\n' ' ')"
else
  info "Todos os containers de regime seguem de pé"
fi

echo ""
info "Status dos containers:"
compose ps

if [[ "$DEPLOY_FAILED" -ne 0 ]]; then
  echo ""
  error "Deploy NÃO concluído — veja os passos marcados com ✗ acima."
  exit 1
fi

echo ""
info "Deploy concluído e verificado."
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
info "HTTPS: o nginx do compose termina TLS na porta ${HTTPS_PORT} com certificado"
info "Let's Encrypt. A renovação roda no container certbot (a cada 12h) e o nginx"
info "recarrega sozinho a cada 6h para captar o certificado novo."
warn "Acessar a app pelo IP ou em http:// não loga: o auth-service marca o cookie de"
warn "sessão como Secure e o navegador o descarta. Use ${PUBLIC_URL}."
echo ""
echo "Validação avulsa: ./deploy/scripts/validate-vps-ready.sh"
echo "Guia completo: docs/DEPLOY_VPS.md"
