# Coloque aqui o JSON da service account do Google Cloud (Vision API).
# Nome esperado: gcp-vision-sa.json
#
# Este diretório inteiro está no .gitignore — nunca versionar o JSON.
# O README.md pode ser commitado.
#
# Dev local (.env na raiz do repo):
#   VISION_OCR_ENABLED=true
#   GOOGLE_APPLICATION_CREDENTIALS=./deploy/secrets/gcp-vision-sa.json
#
# Produção (docker-compose.production.yml monta ./secrets → /run/secrets):
#   VISION_OCR_ENABLED=false          # ligue só quando o JSON estiver no host
#   GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-vision-sa.json
#   VISION_OCR_MAX_PAGES=20
#   VISION_OCR_MIN_TEXT_CHARS=300
#
# API e worker de análise montam este diretório read-only.
