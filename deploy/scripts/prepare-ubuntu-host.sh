#!/usr/bin/env bash
# Prepara Ubuntu (24.04+) para o DOQYN: libera porta HTTP do nginx/apache do sistema.
#
# O DOQYN usa nginx DENTRO do Docker (container deploy/nginx). Não configure
# /etc/nginx do Ubuntu para o app — só desligue o nginx do host.
#
# Uso:
#   sudo ./deploy/scripts/prepare-ubuntu-host.sh
#   sudo ./deploy/scripts/prepare-ubuntu-host.sh --check   # só diagnóstico
#   sudo ./deploy/scripts/prepare-ubuntu-host.sh --purge   # remove pacotes nginx/apache
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}→${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }
note()  { echo -e "${CYAN}·${NC} $*"; }

HTTP_PORT="${HTTP_PORT:-80}"
MODE="${1:-}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  error "Execute com sudo: sudo $0"
  exit 1
fi

show_port_usage() {
  local port="$1"
  echo ""
  note "Processos escutando na porta ${port}:"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp "sport = :${port}" 2>/dev/null || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | grep ":${port} " || true
  else
    warn "ss/netstat não disponível — instale iproute2"
  fi
}

is_port_free() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    if ss -tln "sport = :${port}" 2>/dev/null | grep -q LISTEN; then
      return 1
    fi
  fi
  return 0
}

# A porta ocupada pelo docker-proxy é o nginx da própria stack, não um
# concorrente: o compose libera e reata a porta ao recriar o container. Sem esta
# distinção o script falha em todo redeploy e ainda sugere `fuser -k 80/tcp`,
# que mataria o docker-proxy por baixo do Docker.
is_port_held_by_docker() {
  local port="$1"
  command -v ss >/dev/null 2>&1 || return 1
  ss -tlnp "sport = :${port}" 2>/dev/null | grep -q 'docker-proxy\|dockerd'
}

stop_and_mask_unit() {
  local unit="$1"
  if ! systemctl list-unit-files "$unit" >/dev/null 2>&1; then
    return 0
  fi
  if systemctl is-active --quiet "$unit" 2>/dev/null; then
    info "Parando ${unit}..."
    systemctl stop "$unit" || true
  fi
  if systemctl is-enabled --quiet "$unit" 2>/dev/null; then
    info "Desabilitando ${unit} no boot..."
    systemctl disable "$unit" || true
  fi
  if ! systemctl is-masked --quiet "$unit" 2>/dev/null; then
    info "Mascarando ${unit} (impede restart acidental)..."
    systemctl mask "$unit" || true
  fi
}

echo ""
echo "=== DOQYN — preparação do host Ubuntu ==="
echo ""

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  note "SO: ${PRETTY_NAME:-desconhecido}"
fi

show_port_usage "$HTTP_PORT"

if [[ "$MODE" == "--check" ]]; then
  echo ""
  for svc in nginx apache2; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      warn "${svc} está ATIVO"
    elif systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
      note "${svc} instalado (verifique se está parado/mascarado)"
    fi
  done
  if is_port_free "$HTTP_PORT"; then
    info "Porta ${HTTP_PORT} livre — pronto para docker compose nginx"
  elif is_port_held_by_docker "$HTTP_PORT"; then
    info "Porta ${HTTP_PORT} em uso pelo Docker (nginx da stack) — nada a liberar"
  else
    warn "Porta ${HTTP_PORT} ainda em uso — rode sem --check para liberar"
  fi
  exit 0
fi

info "Parando serviços web do sistema (nginx/apache)..."
stop_and_mask_unit nginx.service
stop_and_mask_unit nginx
stop_and_mask_unit apache2.service
stop_and_mask_unit apache2

# Alguns painéis Hostinger registram sites em sites-enabled — desativa default.
if [[ -d /etc/nginx/sites-enabled ]]; then
  if [[ -L /etc/nginx/sites-enabled/default ]] || [[ -f /etc/nginx/sites-enabled/default ]]; then
    warn "Removendo site default do nginx do sistema (/etc/nginx/sites-enabled/default)..."
    rm -f /etc/nginx/sites-enabled/default
  fi
fi

if [[ "$MODE" == "--purge" ]]; then
  warn "Removendo pacotes nginx/apache (não afeta o nginx do Docker)..."
  apt-get remove -y nginx nginx-common nginx-core apache2 2>/dev/null || true
  apt-get autoremove -y 2>/dev/null || true
fi

sleep 1
show_port_usage "$HTTP_PORT"

echo ""
if is_port_free "$HTTP_PORT"; then
  info "Porta ${HTTP_PORT} livre. Suba o DOQYN com:"
  echo "    ./deploy/scripts/deploy-production.sh"
elif is_port_held_by_docker "$HTTP_PORT"; then
  info "Porta ${HTTP_PORT} em uso pelo Docker (nginx da stack) — o compose reata ao recriar."
  echo "    ./deploy/scripts/deploy-production.sh"
else
  error "Porta ${HTTP_PORT} ainda ocupada."
  echo ""
  note "Tente:"
  echo "  1. sudo $0 --purge"
  echo "  2. sudo fuser -k ${HTTP_PORT}/tcp"
  echo "  3. Verifique outro reverse proxy (Caddy, OpenLiteSpeed, painel Hostinger)"
  exit 1
fi

echo ""
note "Não edite /etc/nginx no Ubuntu para o DOQYN."
note "O proxy correto está em deploy/nginx/default.conf.template (imagem Docker)."
echo ""
