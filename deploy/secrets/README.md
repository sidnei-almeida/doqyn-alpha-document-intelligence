# Coloque aqui o JSON da service account do Google Cloud (Vision API).
# Nome esperado: gcp-vision-sa.json
#
# Este diretório inteiro está no .gitignore — nunca versionar.
#
# Dev local (.env na raiz do repo):
#   VISION_OCR_ENABLED=true
#   GOOGLE_APPLICATION_CREDENTIALS=./deploy/secrets/gcp-vision-sa.json
#
# Produção: monte o arquivo no container / copie para o host e aponte
# GOOGLE_APPLICATION_CREDENTIALS para o path absoluto.
