# Fluxo de storage — DOQYN Alpha

## Visão geral

Existe um único fluxo de entrada de documento:

| Fluxo | Quando o binário é gravado | Mongo `storage.primary` |
|-------|---------------------------|-------------------------|
| **Envio com IA** (UI principal) | Staging no `analyze-pdf`; promoção no `confirm-analysis` | `status=stored`, `objectKey` com `storageFileName` |

O upload legado (`POST /api/documents/upload`) foi removido — gravava o documento sem passar pela
IA e sem sinalizar isso, e a UI nunca o alcançava.

O **nome físico final** no storage segue `storageFileName`, derivado de `finalFileName` (IA, original ou manual).

## Caminhos no storage

### Staging temporário (entre analyze e confirm)

```
{R2 ou LOCAL}/
  tmp/{jobId}/original.pdf                    ← R2 (genérico, OK)
  staging/{tenantId}/{userId}/{jobId}/original.pdf   ← local legado
```

### Storage definitivo — Business

```
documents/{documentId}/versions/{versionId}/original/{storageFileName}
documents/{documentId}/versions/{versionId}/preview/{previewStorageFileName}
```

Exemplo:

```
documents/doc_abc/versions/ver_xyz/original/NDA_Confidencialidade_2026-07-02_v1.pdf
documents/doc_abc/versions/ver_xyz/preview/NDA_Confidencialidade_2026-07-02_v1_preview.pdf
```

### Storage definitivo — Individual (PF)

```
individuals/<hash>/documents/{documentId}/versions/{versionId}/original/{storageFileName}
individuals/<hash>/documents/{documentId}/versions/{versionId}/preview/{previewStorageFileName}
```

### Formatos legados (somente leitura)

Documentos antigos podem ter:

```
.../original.pdf
.../preview/preview.pdf
```

Novos documentos **não** devem usar esses padrões. Download e preview leem o `objectKey` salvo no Mongo — documentos legados continuam funcionando.

## Variáveis de ambiente

```env
STORAGE_PROVIDER=local   # ou r2
LOCAL_STORAGE_ROOT=/var/lib/doqyn-alpha/storage
MAX_UPLOAD_MB=25

# R2 (quando STORAGE_PROVIDER=r2)
R2_DEFAULT_BUCKET=doqyn-alpha
R2_KEY_PREFIX=documents
```

## O que cada etapa altera

### `POST /api/ai/analyze-pdf`

- Recebe multipart com PDF.
- Executa extração de texto, classificação e metadados (IA).
- **Grava staging** temporário (`tmp/{jobId}/original.pdf` no R2).
- Retorna `jobId`, `fileHash`, `recommendedFileName`, classificação etc.
- **Não grava storage definitivo.**

### `POST /api/documents/confirm-analysis`

- Recebe JSON com resultado da análise + `jobId` + `finalFileName` + `namingMode`.
- Resolve nomes via `resolveStorageFileNames` (helper compartilhado).
- Carrega PDF do staging, valida SHA256.
- Promove para path definitivo com `storageFileName`.
- Gera preview com `previewStorageFileName` (`{nome}_preview.pdf`).
- Grava Mongo (`document_versions` com `storageFileName`, `previewStorageFileName`, `objectKey`).
- Remove staging.
- Emite audit: `storage_promoted`, `preview_generated`, `filename_updated` (se nome mudou).

### `GET /api/documents/download`

Query: `documentId`, `versionId` (opcional), `disposition=inline|attachment`.

- Lê `storage.primary.objectKey` do Mongo (fonte da verdade).
- Não reconstrói path fixo.
- `Content-Disposition` usa `finalFileName`.

### `GET /api/documents/preview`

- Lê `storage.preview.objectKey` do Mongo.
- Serve PDF com watermark quando `status=ready`.

## Campos Mongo relevantes (`document_versions`)

| Campo | Descrição |
|-------|-----------|
| `originalFileName` | Nome do arquivo no upload |
| `aiSuggestedFileName` | Sugestão da IA |
| `finalFileName` | Nome lógico final |
| `storageFileName` | Nome físico no objectKey original |
| `previewStorageFileName` | Nome físico do preview |
| `namingMode` | `ai_suggested` \| `original` \| `manual` |
| `storage.primary.objectKey` | Chave R2/local do original |
| `storage.preview.objectKey` | Chave R2/local do preview |

## Nomes bloqueados no storage final

Estes nomes genéricos são substituídos por fallback seguro (`Documento_{documentId}_v{version}.pdf`):

- `original.pdf`
- `preview.pdf`
- `documento.pdf`
- `arquivo.pdf`, `upload.pdf`, `document.pdf`, etc.

## Teste manual (resumo)

1. `npm run dev` com storage configurado.
2. Enviar PDF pela Document Send Page.
3. Confirmar análise com nome sugerido ou manual.
4. No Mongo, verificar `storageFileName` e `storage.primary.objectKey`.
5. No R2, confirmar path `.../original/{storageFileName}`.
6. Testar download e preview.

## Verificação rápida no Mongo

```javascript
db.document_versions_company_dev.findOne(
  { _id: 'ver_…' },
  {
    finalFileName: 1,
    storageFileName: 1,
    previewStorageFileName: 1,
    'storage.primary': 1,
    'storage.preview': 1,
  }
)
```

- `storageFileName` = segmento final do objectKey em `.../original/`.
- `finalFileName` = nome lógico exibido na UI e no download.
