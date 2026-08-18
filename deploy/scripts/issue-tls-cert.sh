#!/usr/bin/env bash
# Emite o certificado Let's Encrypt inicial para o domínio público da app.
#
# Por que um script separado do renew: na primeira vez não existe certificado, e o
# nginx se recusa a subir apontando ssl_certificate para um arquivo inexistente.
# Ou seja, não dá para usar o desafio webroot (que precisa do nginx no ar) antes de
# existir cert. A saída é o desafio standalone: o próprio certbot sobe um servidor
# efêmero na porta 80. A renovação seguinte já roda via webroot, sem downtime, no
# container `certbot` do compose.
#
# Uso:
#   ./deploy/scripts/issue-tls-cert.sh            # emite se ainda não existir
#   ./deploy/scripts/issue-tls-cert.sh --staging  # ambiente de teste do Let's Encrypt
#   ./deploy/scripts/issue-tls-cert.sh --force    # reemite mesmo já existindo
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

STAGING=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --staging) STAGING=1 ;;
    --force)   FORCE=1 ;;
    -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) error "Argumento desconhecido: $arg"; exit 1 ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  error "Arquivo deploy/.env não encontrado."
  echo "Execute primeiro: ./deploy/scripts/setup-production-env.sh"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

AUTH_SERVICE_DIR="${AUTH_SERVICE_DIR:-$(dirname "$PROJECT_ROOT")/doqyn-auth-service}"
export AUTH_SERVICE_DIR

DOMAIN="${LETSENCRYPT_DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-}"

if [[ -z "$DOMAIN" ]]; then
  error "LETSENCRYPT_DOMAIN ausente em deploy/.env"
  echo "    Deve ser o mesmo host de DOQYN_PUBLIC_APP_URL (ex.: app.doqyn.com)"
  exit 1
fi
if [[ -z "$EMAIL" ]]; then
  error "LETSENCRYPT_EMAIL ausente em deploy/.env"
  echo "    O Let's Encrypt usa esse email para avisar de expiração."
  exit 1
fi

cd "$DEPLOY_DIR"

compose() {
  compose_production "$DEPLOY_DIR" "$@"
}

cert_exists() {
  compose run --rm --entrypoint sh certbot \
    -c "test -s /etc/letsencrypt/live/${DOMAIN}/fullchain.pem" >/dev/null 2>&1
}

if [[ "$FORCE" -eq 0 ]] && cert_exists; then
  info "Certificado de ${DOMAIN} já existe — nada a fazer."
  echo "    Renovação é automática (container certbot). Para reemitir: $0 --force"
  exit 0
fi

# O desafio HTTP-01 exige que o Let's Encrypt alcance a porta 80 deste host pelo
# domínio. Checar antes evita queimar tentativa contra o limite de erros da API.
RESOLVED="$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || true)"
if [[ -z "$RESOLVED" ]]; then
  error "O DNS de ${DOMAIN} não resolve — o desafio HTTP-01 vai falhar."
  exit 1
fi
info "DNS de ${DOMAIN} resolve para ${RESOLVED}"

# A porta 80 precisa ficar livre para o servidor efêmero do certbot.
info "Parando o nginx para liberar a porta 80 (janela de alguns segundos)..."
compose stop nginx >/dev/null 2>&1 || true

restore_nginx() {
  info "Subindo o nginx de volta..."
  compose up -d nginx >/dev/null 2>&1 || warn "Suba o nginx manualmente: compose up -d nginx"
}
trap restore_nginx EXIT

CERTBOT_ARGS=(
  certonly
  --standalone
  --non-interactive
  --agree-tos
  --preferred-challenges http
  --key-type ecdsa
  -m "$EMAIL"
  -d "$DOMAIN"
)
[[ "$STAGING" -eq 1 ]] && CERTBOT_ARGS+=(--staging)
[[ "$FORCE" -eq 1 ]] && CERTBOT_ARGS+=(--force-renewal)

if [[ "$STAGING" -eq 1 ]]; then
  warn "Modo --staging: o certificado emitido NÃO é confiável em navegador."
  warn "Serve só para validar o fluxo sem gastar o limite de emissões da conta."
fi

info "Emitindo certificado para ${DOMAIN}..."
if compose run --rm -p 80:80 --entrypoint certbot certbot "${CERTBOT_ARGS[@]}"; then
  info "Certificado emitido."
else
  error "Emissão falhou."
  echo "    Causas comuns: porta 80 bloqueada de fora, DNS apontando para outro host,"
  echo "    ou limite de tentativas do Let's Encrypt (5 falhas por hora por domínio)."
  echo "    Para testar sem consumir o limite: $0 --staging"
  exit 1
fi
