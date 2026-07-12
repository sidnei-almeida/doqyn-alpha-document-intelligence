#!/usr/bin/env bash
# Valida configuração mínima do Vision OCR no host/dev.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}→${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

MODE="${1:---check}"

info "Validando Vision OCR (modo ${MODE})"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

ENABLED="${VISION_OCR_ENABLED:-false}"
CREDS="${GOOGLE_APPLICATION_CREDENTIALS:-}"

info "VISION_OCR_ENABLED=${ENABLED}"

if [[ "${ENABLED}" != "true" && "${ENABLED}" != "1" ]]; then
  warn "OCR desabilitado — OK para PDF digital apenas"
  exit 0
fi

if [[ -z "${CREDS}" ]]; then
  fail "VISION_OCR_ENABLED=true mas GOOGLE_APPLICATION_CREDENTIALS vazio"
fi

if [[ "${CREDS}" = /* ]]; then
  CREDS_PATH="${CREDS}"
else
  CREDS_PATH="${ROOT}/${CREDS#./}"
fi

if [[ ! -f "${CREDS_PATH}" ]]; then
  fail "Arquivo de credenciais não encontrado: ${CREDS_PATH}"
fi

info "Credenciais encontradas: ${CREDS_PATH}"

if command -v node >/dev/null 2>&1; then
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    if (d.type !== 'service_account') process.exit(2);
    if (!d.client_email || !d.private_key) process.exit(3);
    console.log('SA:', d.client_email);
  " "${CREDS_PATH}" || fail "JSON de service account inválido"
fi

info "Vision OCR pronto (credenciais OK)"
