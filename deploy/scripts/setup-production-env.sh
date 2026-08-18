#!/usr/bin/env bash
# Gera deploy/.env de produção (stack completa: auth + alpha + mongo + nginx).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
AUTH_SERVICE_DIR="${AUTH_SERVICE_DIR:-$(dirname "$PROJECT_ROOT")/doqyn-auth-service}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

info()  { echo -e "${GREEN}→${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }

check_dependencies() {
  for cmd in openssl bash; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      error "$cmd não encontrado."
      exit 1
    fi
  done

  if ! command -v docker >/dev/null 2>&1; then
    error "Docker não encontrado. Instale Docker antes de continuar."
    exit 1
  fi

  if docker compose version >/dev/null 2>&1; then
    info "docker compose encontrado."
  elif command -v docker-compose >/dev/null 2>&1; then
    info "docker-compose encontrado."
  else
    error "docker compose não encontrado."
    exit 1
  fi
}

prompt_default() {
  local prompt_text="$1"
  local default="$2"
  local value=""
  read -r -p "${prompt_text} [${default}]: " value
  if [[ -z "$value" ]]; then
    echo "$default"
  else
    echo "$value"
  fi
}

urlencode() {
  local raw="$1"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import urllib.parse; print(urllib.parse.quote('''${raw}''', safe=''))"
  else
    echo "$raw"
  fi
}

generate_hex_secret() { openssl rand -hex 32; }
generate_base64_32() { openssl rand -base64 32; }

extract_domain_from_url() {
  local url="$1"
  echo "$url" | sed -E 's#^https?://##' | sed -E 's#/.*$##' | sed -E 's/^www\.//'
}

if [[ ! -d "$AUTH_SERVICE_DIR" ]]; then
  error "auth-service não encontrado em: $AUTH_SERVICE_DIR"
  echo ""
  echo "Clone os repositórios lado a lado, por exemplo:"
  echo "  ~/doqyn/doqyn-auth-service"
  echo "  ~/doqyn/doqyn-alpha-document-intelligence"
  echo ""
  echo "Ou defina AUTH_SERVICE_DIR=/caminho/para/doqyn-auth-service"
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  read -r -p "Já existe deploy/.env. Sobrescrever? [y/N] " overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    info "Operação cancelada."
    exit 0
  fi
fi

check_dependencies

echo ""
info "Configuração de produção — stack DOQYN (auth + alpha)"
echo ""

PUBLIC_APP_URL="$(prompt_default "URL pública do app (com https)" "https://app.doqyn.com.br")"

# O auth-service força cookie Secure quando NODE_ENV=production
# (doqyn-auth-service/src/security/cookies.ts) — não há flag que desligue isso.
# Cookie Secure em origem http:// é descartado pelo navegador: o login completa no
# servidor e o usuário volta para a tela de login, sem erro visível em lugar nenhum.
if [[ "$PUBLIC_APP_URL" != https://* ]]; then
  echo ""
  warn "URL pública sem https: ${PUBLIC_APP_URL}"
  warn "O login NÃO vai funcionar. O auth-service marca o cookie de sessão como"
  warn "Secure em produção, e o navegador descarta cookie Secure em origem http://."
  warn "Acessar a app pelo IP da VPS tem o mesmo problema."
  echo ""
  echo "  Caminho suportado: domínio apontado para a VPS + TLS na frente do nginx"
  echo "  (Cloudflare com proxy laranja é o mais simples — ver docs/DEPLOY_VPS.md)."
  echo ""
  read -r -p "Continuar mesmo assim (só faz sentido para teste sem login)? [y/N] " http_ack
  if [[ ! "$http_ack" =~ ^[Yy]$ ]]; then
    info "Operação cancelada. Configure o domínio e rode de novo."
    exit 0
  fi
fi

PUBLIC_HOST="$(extract_domain_from_url "$PUBLIC_APP_URL")"
COOKIE_DOMAIN="$(prompt_default "Domínio do cookie (com ponto inicial)" ".${PUBLIC_HOST}")"
HTTP_PORT="$(prompt_default "Porta HTTP exposta no servidor" "80")"

echo ""
info "Banco de dados"
USE_ATLAS="$(prompt_default "Usar MongoDB Atlas? (s/n)" "n")"
if [[ "$USE_ATLAS" =~ ^[Ss]$ ]]; then
  read -r -p "MONGODB_URI (Atlas SRV): " MONGODB_URI
  if [[ -z "$MONGODB_URI" ]]; then
    error "MONGODB_URI é obrigatório para Atlas."
    exit 1
  fi
  MONGODB_DB="$(prompt_default "MONGODB_DATABASE" "doqyn_prod")"
  MONGODB_USE_ATLAS=true
else
  MONGODB_DB="$(prompt_default "Nome do banco Mongo local (Docker)" "doqyn_prod")"
  MONGODB_URI="mongodb://mongo:27017/${MONGODB_DB}"
  MONGODB_USE_ATLAS=false
fi

POSTGRES_DB="$(prompt_default "Postgres — nome do banco (auth)" "doqyn_auth")"
POSTGRES_USER="$(prompt_default "Postgres — usuário" "doqyn_auth")"
# A senha entra crua na DATABASE_URL do pgbouncer e nos fallbacks do compose, então
# caractere reservado de URL quebra a conexão de um jeito difícil de diagnosticar.
# A senha gerada é hex — sempre segura. A digitada é validada.
while :; do
  echo -n "Postgres — senha (vazio = gerar automaticamente): "
  read -r -s POSTGRES_PASSWORD
  echo ""
  if [[ -z "$POSTGRES_PASSWORD" ]]; then
    POSTGRES_PASSWORD="$(generate_hex_secret)"
    info "Senha Postgres gerada automaticamente."
    break
  fi
  if [[ "$POSTGRES_PASSWORD" =~ [^A-Za-z0-9._~-] ]]; then
    warn "Senha rejeitada: use só letras, números e . _ ~ -"
    warn "Outros caracteres (@ : / # ? & espaço) quebram a URL do Postgres/PgBouncer."
    continue
  fi
  break
done

echo ""
info "Storage (Cloudflare R2 — recomendado em produção)"
R2_ACCOUNT_ID="$(prompt_default "R2_ACCOUNT_ID" "")"
R2_ENDPOINT="$(prompt_default "R2_ENDPOINT" "")"
R2_DEFAULT_BUCKET="$(prompt_default "R2_DEFAULT_BUCKET" "doqyn-alpha")"
read -r -p "R2_ACCESS_KEY_ID: " R2_ACCESS_KEY_ID
echo -n "R2_SECRET_ACCESS_KEY: "
read -r -s R2_SECRET_ACCESS_KEY
echo ""
read -r -p "R2_ADMIN_ACCESS_KEY_ID (pode ser igual ao runtime): " R2_ADMIN_ACCESS_KEY_ID
echo -n "R2_ADMIN_SECRET_ACCESS_KEY: "
read -r -s R2_ADMIN_SECRET_ACCESS_KEY
echo ""
R2_ADMIN_ACCESS_KEY_ID="${R2_ADMIN_ACCESS_KEY_ID:-$R2_ACCESS_KEY_ID}"
R2_ADMIN_SECRET_ACCESS_KEY="${R2_ADMIN_SECRET_ACCESS_KEY:-$R2_SECRET_ACCESS_KEY}"

echo ""
info "Análise de documentos (Groq)"
read -r -p "GROQ_API_KEY: " GROQ_API_KEY
GROQ_MODEL_ID="$(prompt_default "Modelo Groq" "meta-llama/llama-4-scout-17b-16e-instruct")"

GROQ_PAID="$(prompt_default "Plano Groq é on-demand (pago)? (s/n)" "s")"
if [[ "$GROQ_PAID" =~ ^[Ss]$ ]]; then
  # Cabe em ~100 páginas dentro da janela de 131k tokens do scout.
  PDF_MAX_PAGES_DEFAULT=100
  PDF_MAX_INPUT_CHARS_DEFAULT=300000
  EXTRACTION_CHUNKS_DEFAULT=40
else
  # Gratuito: 6k TPM por organização. Acima disso a análise retorna 429.
  warn "Plano gratuito: limites reduzidos para não estourar 6k TPM (429)."
  warn "Documento longo será truncado. Migre para on-demand antes de produção real."
  PDF_MAX_PAGES_DEFAULT=10
  PDF_MAX_INPUT_CHARS_DEFAULT=30000
  EXTRACTION_CHUNKS_DEFAULT=8
fi

PDF_MAX_PAGES="$(prompt_default "Máximo de páginas analisadas por documento" "$PDF_MAX_PAGES_DEFAULT")"
PDF_MAX_INPUT_CHARS="$(prompt_default "Máximo de caracteres extraídos por documento" "$PDF_MAX_INPUT_CHARS_DEFAULT")"
EXTRACTION_CHUNKS="$(prompt_default "Chunks enviados ao extrator" "$EXTRACTION_CHUNKS_DEFAULT")"

echo ""
info "OAuth Google (deixe vazio para configurar depois)"
read -r -p "OAUTH_GOOGLE_CLIENT_ID: " OAUTH_GOOGLE_CLIENT_ID
echo -n "OAUTH_GOOGLE_CLIENT_SECRET: "
read -r -s OAUTH_GOOGLE_CLIENT_SECRET
echo ""

info "Gerando chaves internas sincronizadas entre auth e alpha..."
DOQYN_INTERNAL_API_KEY="$(generate_base64_32)"
DOQYN_APP_INTERNAL_API_KEY="$(generate_base64_32)"
DATA_ENCRYPTION_KEY="$(generate_base64_32)"
LOOKUP_HASH_SECRET="$(generate_base64_32)"
SESSION_TOKEN_HASH_SECRET="$(generate_base64_32)"
PASSWORD_RESET_TOKEN_HASH_SECRET="$(generate_base64_32)"
PASSWORD_PEPPER="$(generate_hex_secret)"
TRACKING_IP_ENCRYPTION_KEY="$(generate_hex_secret)"
TRACKING_IP_HASH_SALT="$(generate_hex_secret)"
METRICS_TOKEN="$(generate_hex_secret)"
GRAFANA_ADMIN_PASSWORD="$(generate_base64_32)"

ENCODED_PASSWORD="$(urlencode "$POSTGRES_PASSWORD")"
DATABASE_URL_DIRECT="postgresql://${POSTGRES_USER}:${ENCODED_PASSWORD}@postgres-auth:5432/${POSTGRES_DB}"
DATABASE_URL="postgresql://${POSTGRES_USER}:${ENCODED_PASSWORD}@pgbouncer:5432/${POSTGRES_DB}"

OAUTH_GOOGLE_REDIRECT_URI="${PUBLIC_APP_URL%/}/oauth/google/callback"
OAUTH_MICROSOFT_REDIRECT_URI="${PUBLIC_APP_URL%/}/oauth/microsoft/callback"
OAUTH_POST_LOGIN_REDIRECT_URL="${PUBLIC_APP_URL%/}/auth/oauth/callback"
OAUTH_ERROR_REDIRECT_URL="${PUBLIC_APP_URL%/}/login"

cat > "$ENV_FILE" <<EOF
# Gerado por deploy/scripts/setup-production-env.sh — NÃO commitar.

COMPOSE_PROJECT_NAME=doqyn
AUTH_SERVICE_DIR=${AUTH_SERVICE_DIR}
HTTP_PORT=${HTTP_PORT}

# URL pública
DOQYN_PUBLIC_APP_URL=${PUBLIC_APP_URL}

# Postgres (auth)
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Auth-service
PORT=4100
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
DATABASE_URL_DIRECT=${DATABASE_URL_DIRECT}
SESSION_COOKIE_NAME=doqyn_session
SESSION_TTL_DAYS=7
COOKIE_DOMAIN=${COOKIE_DOMAIN}
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
ALLOWED_ORIGINS=${PUBLIC_APP_URL}
DOQYN_INTERNAL_API_KEY=${DOQYN_INTERNAL_API_KEY}
DOQYN_APP_BASE_URL=http://doqyn-api:3001
DOQYN_APP_INTERNAL_API_KEY=${DOQYN_APP_INTERNAL_API_KEY}
DOQYN_APP_PUBLIC_URL=${PUBLIC_APP_URL}
DATA_ENCRYPTION_KEY=${DATA_ENCRYPTION_KEY}
LOOKUP_HASH_SECRET=${LOOKUP_HASH_SECRET}
SESSION_TOKEN_HASH_SECRET=${SESSION_TOKEN_HASH_SECRET}
PASSWORD_RESET_TOKEN_HASH_SECRET=${PASSWORD_RESET_TOKEN_HASH_SECRET}
PASSWORD_PEPPER=${PASSWORD_PEPPER}
PASSWORD_RESET_TTL_MINUTES=30
EMAIL_VERIFICATION_TTL_HOURS=24
EMAIL_ENABLED=false
OAUTH_GOOGLE_ENABLED=$([[ -n "$OAUTH_GOOGLE_CLIENT_ID" ]] && echo true || echo false)
OAUTH_GOOGLE_CLIENT_ID=${OAUTH_GOOGLE_CLIENT_ID}
OAUTH_GOOGLE_CLIENT_SECRET=${OAUTH_GOOGLE_CLIENT_SECRET}
OAUTH_GOOGLE_REDIRECT_URI=${OAUTH_GOOGLE_REDIRECT_URI}
OAUTH_MICROSOFT_ENABLED=false
OAUTH_MICROSOFT_REDIRECT_URI=${OAUTH_MICROSOFT_REDIRECT_URI}
OAUTH_POST_LOGIN_REDIRECT_URL=${OAUTH_POST_LOGIN_REDIRECT_URL}
OAUTH_ERROR_REDIRECT_URL=${OAUTH_ERROR_REDIRECT_URL}

# Alpha API
APP_ENV=production
AUTH_PROVIDER=doqyn_auth
API_PORT=3001
DOQYN_AUTH_BASE_URL=http://auth-api:4100
DOQYN_AUTH_INTERNAL_API_KEY=${DOQYN_INTERNAL_API_KEY}
DOQYN_AUTH_COOKIE_NAME=doqyn_session
MONGODB_URI=${MONGODB_URI}
MONGODB_DATABASE=${MONGODB_DB:-doqyn_prod}
MONGODB_USE_ATLAS=${MONGODB_USE_ATLAS:-false}
MONGODB_SERVER_SELECTION_TIMEOUT_MS=$([[ "${MONGODB_USE_ATLAS}" == "true" ]] && echo 10000 || echo 5000)
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ENDPOINT=${R2_ENDPOINT}
R2_REGION=auto
R2_BUCKET_MODE=per_tenant
R2_DEFAULT_BUCKET=${R2_DEFAULT_BUCKET}
R2_BUCKET_PREFIX=doqyn
R2_KEY_PREFIX=documents
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
R2_ADMIN_ACCESS_KEY_ID=${R2_ADMIN_ACCESS_KEY_ID}
R2_ADMIN_SECRET_ACCESS_KEY=${R2_ADMIN_SECRET_ACCESS_KEY}
GROQ_API_KEY=${GROQ_API_KEY}
GROQ_MODEL=${GROQ_MODEL_ID}
GROQ_REQUEST_TIMEOUT_MS=25000
# Dimensionados para a janela de 131k tokens do llama-4-scout (~460k chars):
# documento de ~100 páginas cabe no contexto. Exige plano on-demand pago —
# no gratuito (6k TPM) um documento sozinho já estoura e retorna 429.
PDF_ANALYSIS_MAX_INPUT_CHARS=${PDF_MAX_INPUT_CHARS}
PDF_ANALYSIS_MAX_PAGES=${PDF_MAX_PAGES}
# Chunks enviados ao extrator. Abaixo disso, subir MAX_PAGES não adianta: o
# texto é extraído mas nunca chega ao modelo.
EXTRACTION_MAX_CHUNKS=${EXTRACTION_CHUNKS}
DOCUMENT_ANALYSIS_PROVIDER=groq

# Google Cloud Vision — OCR (desligado por padrão; JSON em deploy/secrets/)
VISION_OCR_ENABLED=false
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-vision-sa.json
VISION_OCR_MAX_PAGES=20
VISION_OCR_MIN_TEXT_CHARS=300

# Redis (fila BullMQ, cache de sessão, quotas + rate limit do auth-service)
# Compose força REDIS_KEY_PREFIX=doqyn:alpha: na API/workers e doqyn:auth: no auth-api
REDIS_URL=redis://redis:6379
REDIS_ENABLED=true
REDIS_KEY_PREFIX=doqyn:alpha:

# Auth-service — rate limit distribuído (mesmo Redis)
RATE_LIMIT_REDIS_ENABLED=true

# PgBouncer (pool Postgres do auth)
PGBOUNCER_MAX_CLIENT_CONN=500
PGBOUNCER_DEFAULT_POOL_SIZE=25

# Réplicas HTTP (nginx least_conn + DNS Docker)
# 1/1 é o padrão para VPS de 2 vCPU: cada réplica extra reserva CPU e RAM que os
# 3 processos Node já disputam. Suba só depois de medir, e junto com o plano da VPS.
AUTH_API_REPLICAS=1
DOQYN_API_REPLICAS=1

# Upload presigned R2 (Fase B.5)
PRESIGNED_UPLOAD_ENABLED=true
PRESIGNED_UPLOAD_TTL_SECONDS=900
VITE_PRESIGNED_UPLOAD_ENABLED=true

# Fila de análise assíncrona
# Dimensionado para 2 vCPU. O default do código é 10/2 — oversubscription de 5x.
# Este arquivo tem precedência sobre os defaults do docker-compose: mexer aqui é
# mexer no que o worker realmente usa.
ANALYSIS_SYNC_FALLBACK=false
ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=2
ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT=1
ANALYSIS_JOB_TTL_HOURS=24

# Fila de preview assíncrona (Ghostscript fora da API)
# Cada job gera um Ghostscript CPU-bound: 1 por vez em 2 vCPU.
PREVIEW_SYNC_FALLBACK=false
PREVIEW_QUEUE_CONCURRENCY_GLOBAL=1
PREVIEW_JOB_TTL_HOURS=24

# MongoDB pool
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=5

# Cache de sessão auth
SESSION_CACHE_ENABLED=true
SESSION_CACHE_TTL_SECONDS=45

# Quotas por tenant
TENANT_QUOTA_ENABLED=true
TENANT_QUOTA_ANALYSIS_PER_DAY=200
TENANT_QUOTA_UPLOADS_PER_HOUR=60

# Prometheus
METRICS_ENABLED=true
METRICS_TOKEN=${METRICS_TOKEN}
METRICS_SERVICE_NAME=doqyn-api
METRICS_PORT=9100

# Observabilidade (profile opcional)
# Desligada por padrão: Prometheus + Grafana somam ~900 MB de teto e, com Mongo
# local, a stack passa de 7 GB numa VPS de 8 GB. Suba sob demanda com
# ./deploy/scripts/up-observability.sh, ou ligue aqui se a VPS tiver folga.
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
OBSERVABILITY_ENABLE=false

TRACKING_IP_ENCRYPTION_KEY=${TRACKING_IP_ENCRYPTION_KEY}
TRACKING_IP_HASH_SALT=${TRACKING_IP_HASH_SALT}

# Frontend (build-time)
VITE_APP_NAME=DOQYN
VITE_AUTH_PROVIDER=doqyn_auth
VITE_AUTH_BASE_PATH=/auth
VITE_UPLOAD_ANALYZE_TIMEOUT_MS=60000
EOF

chmod 600 "$ENV_FILE"

"$SCRIPT_DIR/sync-observability-secrets.sh" "$ENV_FILE"

echo ""
warn "Guarde backup seguro de deploy/.env (especialmente DATA_ENCRYPTION_KEY e METRICS_TOKEN)."
echo ""
info "Arquivo criado: ${ENV_FILE}"
info "Próximo passo:"
echo "  ./deploy/scripts/deploy-production.sh"
echo ""
if [[ -n "$OAUTH_GOOGLE_CLIENT_ID" ]]; then
  warn "No Google Cloud Console, cadastre redirect URI:"
  echo "  ${OAUTH_GOOGLE_REDIRECT_URI}"
fi
