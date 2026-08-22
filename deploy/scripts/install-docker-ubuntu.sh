#!/usr/bin/env bash
# Instala Docker Engine + plugin Compose numa Ubuntu limpa (Hostinger VPS).
#
# Existe porque prepare-ubuntu-host.sh só libera a porta 80 — ele pressupõe
# Docker já instalado, e numa VPS recém-provisionada não está. Sem isto, o
# primeiro comando do deploy morre em "docker: command not found".
#
# Uso:
#   sudo ./deploy/scripts/install-docker-ubuntu.sh
#   sudo ./deploy/scripts/install-docker-ubuntu.sh --check   # só diagnóstico
#
# Usa o repositório oficial da Docker, não o pacote docker.io do Ubuntu: o
# plugin `docker compose` (v2) não vem no docker.io, e todo o deploy depende
# dele — não do `docker-compose` v1, que está morto.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}→${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }
note()  { echo -e "${CYAN}·${NC} $*"; }

MODE="${1:-}"

have_docker()  { command -v docker >/dev/null 2>&1; }
have_compose() { docker compose version >/dev/null 2>&1; }

report() {
  echo ""
  note "Estado atual:"
  if have_docker; then
    info "docker: $(docker --version 2>/dev/null)"
  else
    error "docker: ausente"
  fi
  if have_compose; then
    info "compose: $(docker compose version --short 2>/dev/null || docker compose version)"
  else
    error "compose: ausente (plugin v2)"
  fi
  if have_docker && ! docker info >/dev/null 2>&1; then
    warn "daemon não responde — 'systemctl status docker' para investigar"
  fi
}

if [[ "$MODE" == "--check" ]]; then
  report
  if have_docker && have_compose && docker info >/dev/null 2>&1; then
    echo ""
    info "Host pronto para o deploy."
    exit 0
  fi
  echo ""
  warn "Rode sem --check para instalar: sudo $0"
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  error "Execute com sudo: sudo $0"
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  error "/etc/os-release ausente — não consigo identificar a distribuição."
  exit 1
fi
# shellcheck disable=SC1091
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *debian* ]]; then
  error "Este script cobre Ubuntu/Debian. Detectado: ${PRETTY_NAME:-desconhecido}"
  exit 1
fi

if have_docker && have_compose; then
  info "Docker e plugin Compose já instalados — nada a fazer."
  report
  exit 0
fi

info "Instalando pré-requisitos..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg

info "Registrando a chave e o repositório oficiais da Docker..."
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
if [[ -z "$CODENAME" ]]; then
  error "Não consegui determinar o codename da distribuição."
  exit 1
fi
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

info "Instalando Docker Engine e plugin Compose..."
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

info "Habilitando o serviço..."
systemctl enable --now docker

# Quem chamou via sudo passa a usar docker sem sudo — mas só na próxima sessão.
TARGET_USER="${SUDO_USER:-}"
if [[ -n "$TARGET_USER" && "$TARGET_USER" != "root" ]]; then
  if ! id -nG "$TARGET_USER" | tr ' ' '\n' | grep -qx docker; then
    usermod -aG docker "$TARGET_USER"
    warn "Usuário '$TARGET_USER' adicionado ao grupo docker — saia e entre de novo (ou 'newgrp docker') para valer."
  fi
fi

report

echo ""
if have_docker && have_compose && docker info >/dev/null 2>&1; then
  info "Docker pronto. Próximos passos:"
  echo "    sudo ./deploy/scripts/prepare-ubuntu-host.sh   # libera a porta 80"
  echo "    ./deploy/scripts/setup-production-env.sh       # gera deploy/.env"
  echo "    ./deploy/scripts/validate-vps-ready.sh         # confere antes de subir"
  echo "    ./deploy/scripts/deploy-production.sh          # sobe a stack"
else
  error "Instalação terminou mas o Docker não respondeu. Veja 'systemctl status docker'."
  exit 1
fi
