#!/usr/bin/env bash
# Roteiro manual de reset DEV — NÃO executa nada automaticamente entre repositórios.
set -euo pipefail

cat <<'EOF'
================================================================================
DOQYN — ROTEIRO MANUAL DE RESET DEV (local)
================================================================================

Este roteiro NÃO executa resets sozinho. Siga na ordem, confirmando cada etapa.

1) Auth-service (Postgres) — dry-run
   cd ~/Documents/GitHub/doqyn-auth-service
   npm run dev:reset:postgres

2) Auth-service — executar reset + seed
   npm run dev:reset:postgres -- --confirm-reset-doqyn-dev

3) App principal (MongoDB) — dry-run
   cd ~/Documents/GitHub/doqyn-alpha-document-intelligence
   npm run dev:reset:mongo

4) App principal — executar reset
   npm run dev:reset:mongo -- --confirm-reset-doqyn-dev

5) (Opcional) Recriar fixtures Mongo de dev
   npm run db:setup

6) Subir serviços
   # terminal 1
   cd ~/Documents/GitHub/doqyn-auth-service && npm run dev
   # terminal 2
   cd ~/Documents/GitHub/doqyn-alpha-document-intelligence && npm run dev

7) Teste manual sugerido
   - login com sidnei@doqyn.dev (senha do SEED_DEV_PASSWORD / fallback do seed)
   - OU signup empresa/individual do zero
   - upload/analyze/confirm/download

NÃO altera R2. NÃO altera .env.
================================================================================
EOF
