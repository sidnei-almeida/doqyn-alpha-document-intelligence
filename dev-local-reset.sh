#!/usr/bin/env bash
# Substituído por ./doqyn — mantido só para não quebrar memória muscular.
#
# Este script resetava o Mongo sem checar se MONGODB_URI apontava para o Atlas,
# então "dev local" apagava banco remoto. O guard agora vive em `./doqyn reset`,
# que exige nome de banco com padrão de dev e confirmação digitada quando o host
# é remoto.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "dev-local-reset.sh foi substituído por ./doqyn"
echo
echo "  ./doqyn up      sobe tudo preservando os dados (é o que você quer no dia a dia)"
echo "  ./doqyn reset   apaga os bancos e semeia do zero"
echo
exec "$SCRIPT_DIR/doqyn" --help
