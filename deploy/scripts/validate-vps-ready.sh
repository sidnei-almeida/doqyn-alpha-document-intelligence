#!/usr/bin/env bash
# Valida se o deploy está pronto para VPS (env, compose, secrets, health opcional).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

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
  require_var DOQYN_AUTH_INTERNAL_API_KEY
  require_var DATA_ENCRYPTION_KEY

  # Mesma chave com dois nomes: o auth lê DOQYN_INTERNAL_API_KEY, a alpha lê
  # DOQYN_AUTH_INTERNAL_API_KEY. Editar só um lado faz todo request da alpha ao
  # auth virar 401 — e o sintoma aparece como "sessão inválida" no navegador.
  # Nunca imprime valor, só o veredito.
  if [[ -n "${DOQYN_INTERNAL_API_KEY:-}" && -n "${DOQYN_AUTH_INTERNAL_API_KEY:-}" ]]; then
    if [[ "${DOQYN_INTERNAL_API_KEY}" == "${DOQYN_AUTH_INTERNAL_API_KEY}" ]]; then
      ok "DOQYN_INTERNAL_API_KEY == DOQYN_AUTH_INTERNAL_API_KEY"
    else
      fail "DOQYN_AUTH_INTERNAL_API_KEY difere de DOQYN_INTERNAL_API_KEY — alpha não autentica no auth (401)"
    fi
  fi

  if [[ -n "${DOQYN_AUTH_COOKIE_NAME:-}" && -n "${SESSION_COOKIE_NAME:-}" ]]; then
    if [[ "${DOQYN_AUTH_COOKIE_NAME}" == "${SESSION_COOKIE_NAME}" ]]; then
      ok "DOQYN_AUTH_COOKIE_NAME == SESSION_COOKIE_NAME (${SESSION_COOKIE_NAME})"
    else
      fail "DOQYN_AUTH_COOKIE_NAME=${DOQYN_AUTH_COOKIE_NAME} difere de SESSION_COOKIE_NAME=${SESSION_COOKIE_NAME} — a alpha lê um cookie que o auth nunca emite"
    fi
  else
    warn "DOQYN_AUTH_COOKIE_NAME ou SESSION_COOKIE_NAME ausente — ambos devem valer doqyn_session"
  fi

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

info_section "URL pública, TLS e cookie de sessão"

# O auth-service força cookie Secure quando NODE_ENV=production
# (doqyn-auth-service/src/security/cookies.ts) — sem flag para desligar. Origem
# http:// (ou o IP cru da VPS) faz o navegador descartar o cookie: o login
# completa no servidor e a tela volta para o login, sem erro em lugar nenhum.
if [[ -f "$ENV_FILE" ]]; then
  PUBLIC_URL="${DOQYN_PUBLIC_APP_URL:-}"
  if [[ -z "$PUBLIC_URL" ]]; then
    fail "DOQYN_PUBLIC_APP_URL ausente"
  elif [[ "$PUBLIC_URL" == https://* ]]; then
    ok "DOQYN_PUBLIC_APP_URL usa https (${PUBLIC_URL})"
  else
    fail "DOQYN_PUBLIC_APP_URL=${PUBLIC_URL} não é https — login impossível (cookie Secure descartado)"
  fi

  PUBLIC_HOST="$(printf '%s' "$PUBLIC_URL" | sed -E 's#^https?://##; s#/.*$##; s#:[0-9]+$##')"

  if [[ -n "$PUBLIC_HOST" ]]; then
    if [[ "$PUBLIC_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      fail "DOQYN_PUBLIC_APP_URL aponta para um IP (${PUBLIC_HOST}) — cookie de sessão exige domínio + TLS"
    else
      ok "Domínio público: ${PUBLIC_HOST}"
    fi
  fi

  COOKIE_DOM="${COOKIE_DOMAIN:-}"
  if [[ -z "$COOKIE_DOM" ]]; then
    warn "COOKIE_DOMAIN vazio — cookie fica restrito ao host exato que respondeu"
  elif [[ "$PUBLIC_HOST" == "${COOKIE_DOM#.}" || "$PUBLIC_HOST" == *"${COOKIE_DOM}" ]]; then
    ok "COOKIE_DOMAIN=${COOKIE_DOM} cobre ${PUBLIC_HOST}"
  else
    fail "COOKIE_DOMAIN=${COOKIE_DOM} não cobre ${PUBLIC_HOST} — navegador rejeita o cookie de sessão"
  fi

  if [[ "${COOKIE_SECURE:-}" == "true" ]]; then
    ok "COOKIE_SECURE=true"
  else
    warn "COOKIE_SECURE=${COOKIE_SECURE:-vazio} — irrelevante: NODE_ENV=production já força Secure"
  fi

  if [[ -z "${ALLOWED_ORIGINS:-}" ]]; then
    fail "ALLOWED_ORIGINS ausente — CORS do auth bloqueia o front"
  elif [[ ",${ALLOWED_ORIGINS}," == *",${PUBLIC_URL},"* ]]; then
    ok "ALLOWED_ORIGINS contém ${PUBLIC_URL}"
  else
    fail "ALLOWED_ORIGINS não contém ${PUBLIC_URL} — CORS do auth bloqueia o front"
  fi

  if [[ "${OAUTH_GOOGLE_ENABLED:-false}" == "true" ]]; then
    if [[ "${OAUTH_GOOGLE_REDIRECT_URI:-}" == "${PUBLIC_URL%/}/oauth/google/callback" ]]; then
      ok "OAUTH_GOOGLE_REDIRECT_URI na origem pública"
      warn "Confirme essa mesma URI cadastrada no Google Cloud Console"
    else
      fail "OAUTH_GOOGLE_REDIRECT_URI=${OAUTH_GOOGLE_REDIRECT_URI:-vazio} fora da origem pública"
    fi
  fi
fi

info_section "Limites de análise de documento"
if [[ -f "$ENV_FILE" ]]; then
  MAX_PAGES="${PDF_ANALYSIS_MAX_PAGES:-100}"
  MAX_CHUNKS="${EXTRACTION_MAX_CHUNKS:-40}"
  MODEL="${GROQ_MODEL:-}"

  ok "GROQ_MODEL=${MODEL:-(default do código)}"
  ok "PDF_ANALYSIS_MAX_PAGES=${MAX_PAGES} | EXTRACTION_MAX_CHUNKS=${MAX_CHUNKS}"

  # Extrair muita página sem elevar os chunks não serve para nada: o texto é
  # extraído e descartado antes de chegar ao modelo.
  if [[ "$MAX_PAGES" -gt 20 && "$MAX_CHUNKS" -le 8 ]]; then
    warn "MAX_PAGES=${MAX_PAGES} com EXTRACTION_MAX_CHUNKS=${MAX_CHUNKS}: o texto além"
    warn "dos primeiros ~8 trechos é extraído mas nunca chega ao modelo. Suba"
    warn "EXTRACTION_MAX_CHUNKS ou reduza MAX_PAGES."
  fi

  # Limites altos exigem janela de contexto grande.
  if [[ "$MAX_CHUNKS" -gt 8 && "$MODEL" == *"8b-instant"* ]]; then
    warn "EXTRACTION_MAX_CHUNKS=${MAX_CHUNKS} com ${MODEL}: modelo pequeno para esse"
    warn "volume. Considere meta-llama/llama-4-scout-17b-16e-instruct (131k tokens)."
  fi

  if [[ "$MAX_PAGES" -le 10 ]]; then
    warn "PDF_ANALYSIS_MAX_PAGES=${MAX_PAGES}: documento maior é cortado nessa página"
    warn "e o que vem depois (assinatura, vigência) não é extraído."
  fi
fi

info_section "Réplicas (Fase B.4)"

if [[ -f "$ENV_FILE" ]]; then
  HOST_CPUS="$(nproc 2>/dev/null || echo 0)"

  for name in AUTH_API_REPLICAS DOQYN_API_REPLICAS; do
    raw="${!name:-}"
    if [[ ! "$raw" =~ ^[0-9]+$ ]] || [[ "$raw" -lt 1 ]]; then
      fail "${name} inválido ou ausente (use inteiro >= 1)"
    elif [[ "$raw" -gt 1 && "$HOST_CPUS" -gt 0 && "$HOST_CPUS" -le 2 ]]; then
      warn "${name}=${raw} com ${HOST_CPUS} vCPU — réplicas disputam os mesmos núcleos dos 3 processos Node. Use 1."
    else
      ok "${name}=${raw}"
    fi
  done

  # As filas: o .env tem precedência sobre os defaults do compose, então é aqui
  # que o valor real do worker é decidido.
  ANALYSIS_GLOBAL="${ANALYSIS_QUEUE_CONCURRENCY_GLOBAL:-10}"
  PREVIEW_GLOBAL="${PREVIEW_QUEUE_CONCURRENCY_GLOBAL:-4}"
  if [[ "$HOST_CPUS" -gt 0 && "$ANALYSIS_GLOBAL" -gt "$HOST_CPUS" ]]; then
    warn "ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=${ANALYSIS_GLOBAL} acima de ${HOST_CPUS} vCPU"
  else
    ok "ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=${ANALYSIS_GLOBAL}"
  fi
  if [[ "$PREVIEW_GLOBAL" -gt 1 && "$HOST_CPUS" -gt 0 && "$HOST_CPUS" -le 2 ]]; then
    warn "PREVIEW_QUEUE_CONCURRENCY_GLOBAL=${PREVIEW_GLOBAL} com ${HOST_CPUS} vCPU — cada job é um Ghostscript CPU-bound. Use 1."
  else
    ok "PREVIEW_QUEUE_CONCURRENCY_GLOBAL=${PREVIEW_GLOBAL}"
  fi

  if [[ -f "$DEPLOY_DIR/nginx/default.conf" ]]; then
    if grep -q 'least_conn' "$DEPLOY_DIR/nginx/default.conf" && grep -q '127.0.0.11' "$DEPLOY_DIR/nginx/default.conf"; then
      ok "nginx configurado para balanceamento dinâmico"
    else
      fail "nginx/default.conf sem least_conn ou resolver Docker"
    fi
  fi
fi

info_section "Vision OCR (opcional)"

if [[ -f "$ENV_FILE" ]]; then
  VISION_ON="${VISION_OCR_ENABLED:-false}"
  if [[ "$VISION_ON" == "true" ]]; then
    ok "VISION_OCR_ENABLED=true"
    if [[ -f "$DEPLOY_DIR/secrets/gcp-vision-sa.json" ]]; then
      ok "deploy/secrets/gcp-vision-sa.json presente"
    else
      fail "VISION_OCR_ENABLED=true mas falta deploy/secrets/gcp-vision-sa.json"
    fi
    if [[ "${GOOGLE_APPLICATION_CREDENTIALS:-}" == "/run/secrets/gcp-vision-sa.json" ]]; then
      ok "GOOGLE_APPLICATION_CREDENTIALS aponta para /run/secrets/gcp-vision-sa.json"
    else
      warn "GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-vazio} (esperado /run/secrets/gcp-vision-sa.json no Docker)"
    fi
  else
    warn "VISION_OCR_ENABLED=false — OCR de PDF escaneado desligado (ok por padrão)"
    if [[ -f "$DEPLOY_DIR/secrets/gcp-vision-sa.json" ]]; then
      ok "gcp-vision-sa.json presente (pronto para ligar VISION_OCR_ENABLED)"
    else
      warn "gcp-vision-sa.json ausente — copie a SA para deploy/secrets/ antes de ligar OCR"
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
    ok "OBSERVABILITY_ENABLE=false (padrão) — suba sob demanda com ./deploy/scripts/up-observability.sh"
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

info_section "Dimensionamento de memória"

# Soma os mem_limit direto do compose resolvido, para o número não divergir do
# arquivo. Serviços one-shot (auth-migrate, doqyn-api-indexes) ficam de fora:
# rodam e saem, não concorrem com o regime normal.
if docker compose version >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  HOST_MEM_MB="$(awk '/^MemTotal:/ { printf "%d", $2 / 1024 }' /proc/meminfo 2>/dev/null || echo 0)"

  # Serviço de profile inativo some do `config`, então somar com o wrapper padrão
  # deixaria prometheus + grafana + redis-exporter (~960 MiB) de fora justamente
  # quando deploy-production.sh vai subir os três no fim do deploy.
  if [[ "${OBSERVABILITY_ENABLE:-false}" == "true" ]]; then
    SIZING_COMPOSE=compose_production_observability
    SIZING_SCOPE="stack + observabilidade"
  else
    SIZING_COMPOSE=compose_production
    SIZING_SCOPE="stack principal"
  fi

  # --format json em vez do YAML padrão: o módulo json é builtin, PyYAML não é e
  # costuma faltar numa VPS Ubuntu recém-instalada.
  SIZING="$(
    AUTH_API_REPLICAS="${AUTH_API_REPLICAS:-1}" \
    DOQYN_API_REPLICAS="${DOQYN_API_REPLICAS:-1}" \
    "$SIZING_COMPOSE" "$DEPLOY_DIR" config --format json 2>/dev/null \
      | AUTH_API_REPLICAS="${AUTH_API_REPLICAS:-1}" DOQYN_API_REPLICAS="${DOQYN_API_REPLICAS:-1}" python3 -c '
import json, os, sys

doc = json.load(sys.stdin) or {}
# One-shot: rodam e saem, não concorrem com o regime normal.
one_shot = {"auth-migrate", "doqyn-api-indexes"}
replicas = {
    "auth-api": int(os.environ.get("AUTH_API_REPLICAS", "1") or 1),
    "doqyn-api": int(os.environ.get("DOQYN_API_REPLICAS", "1") or 1),
}
total = 0.0
unbounded = []
for name, svc in (doc.get("services") or {}).items():
    if name in one_shot:
        continue
    limit = svc.get("mem_limit")
    if limit is None:
        unbounded.append(name)
        continue
    total += int(limit) / 1024 / 1024 * replicas.get(name, 1)
sys.stdout.write("%.0f|%s" % (total, ",".join(unbounded)))
' 2>/dev/null || true)"

  RESERVED_MB="${SIZING%%|*}"
  UNBOUNDED="${SIZING#*|}"

  if [[ "$RESERVED_MB" =~ ^[0-9]+$ ]] && [[ "$RESERVED_MB" -gt 0 ]]; then
    ok "Teto somado dos containers (${SIZING_SCOPE}): ${RESERVED_MB} MiB"
    if [[ -n "$UNBOUNDED" ]]; then
      fail "Serviços sem mem_limit (podem consumir a RAM toda): ${UNBOUNDED}"
    fi
    if [[ "$HOST_MEM_MB" -gt 0 ]]; then
      # 1 GiB para kernel, dockerd, sshd e o próprio build.
      BUDGET_MB=$(( HOST_MEM_MB - 1024 ))
      if [[ "$RESERVED_MB" -gt "$HOST_MEM_MB" ]]; then
        fail "Teto ${RESERVED_MB} MiB acima da RAM do host (${HOST_MEM_MB} MiB) — OOM garantido sob carga"
      elif [[ "$RESERVED_MB" -gt "$BUDGET_MB" ]]; then
        warn "Teto ${RESERVED_MB} MiB deixa menos de 1 GiB para o SO (RAM: ${HOST_MEM_MB} MiB)"
        warn "Reduza réplicas, use MongoDB Atlas ou desligue OBSERVABILITY_ENABLE"
      else
        ok "Cabe na RAM do host (${HOST_MEM_MB} MiB, sobra ≥1 GiB para o SO)"
      fi
    else
      warn "RAM do host não detectada — confira o teto contra o plano da VPS"
    fi
  else
    warn "Não foi possível somar os mem_limit — confira manualmente"
  fi
else
  warn "docker compose ou python3 ausente — pulando checagem de memória"
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
