#!/usr/bin/env bash
# Sobe o DOQYN na VPS — um comando só.
#
# Este arquivo é só um atalho. Toda a lógica de deploy vive em
# deploy/scripts/deploy-production.sh, que é o único caminho suportado.
#
# Antes tinha uma sequência própria de `compose up` aqui, e ela ficou para trás:
# não subia o doqyn-worker-preview, então os previews de PDF nunca eram gerados —
# sem erro em lugar nenhum. Delegar em vez de duplicar impede que volte a divergir.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$DEPLOY_DIR/scripts/deploy-production.sh" "$@"
