#!/usr/bin/env bash
# Backup read-only dos bancos candidatos à limpeza.
# Não commitar a pasta backups/ — já está no .gitignore.
#
# Uso: npm run mongo:backup
#
# Requer: mongodump instalado (pacote mongodb-database-tools)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "ERRO: MONGODB_URI não definida no .env" >&2
  exit 1
fi

if ! command -v mongodump >/dev/null 2>&1; then
  echo "ERRO: mongodump não encontrado." >&2
  echo "Instale mongodb-database-tools (Arch: mongodb-database-tools-bin ou pacote oficial)." >&2
  exit 1
fi

ACTIVE_DB="${MONGODB_DATABASE:-doqyn_dev}"
LEGACY_DB="${MONGODB_DB_NAME:-doqyn_alpha}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/backups/mongo-cleanup-$STAMP"

mkdir -p "$OUT_DIR"

echo "=== Backup MongoDB antes de limpeza ==="
echo "Destino: $OUT_DIR"
echo "Database ativo: $ACTIVE_DB"
echo "Database legado: $LEGACY_DB"
echo ""

echo ">> Dump $ACTIVE_DB (database ativo — backup completo de segurança)"
mongodump --uri "$MONGODB_URI" --db "$ACTIVE_DB" --out "$OUT_DIR"

if [[ "$LEGACY_DB" != "$ACTIVE_DB" ]]; then
  echo ">> Dump $LEGACY_DB (candidato legado)"
  mongodump --uri "$MONGODB_URI" --db "$LEGACY_DB" --out "$OUT_DIR" || {
    echo "Aviso: dump de $LEGACY_DB falhou ou database vazio/inexistente."
  }
fi

cat > "$OUT_DIR/README.txt" <<EOF
Backup gerado em: $(date -Iseconds)
Database ativo: $ACTIVE_DB
Database legado: $LEGACY_DB

Restaurar collection:
  mongorestore --uri "\$MONGODB_URI" --db $ACTIVE_DB --collection NOME $OUT_DIR/$ACTIVE_DB/NOME.bson

Restaurar database inteiro:
  mongorestore --uri "\$MONGODB_URI" --db $ACTIVE_DB --drop $OUT_DIR/$ACTIVE_DB

NÃO commitar esta pasta no Git.
EOF

echo ""
echo "Backup concluído: $OUT_DIR"
echo "Próximo passo: npm run mongo:cleanup:dry-run"
