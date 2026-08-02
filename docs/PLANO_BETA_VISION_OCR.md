# Plano Beta — Vision OCR, Heurísticas e Metadados Flexíveis

**Objetivo:** destravar PDFs escaneados, fotos e imagens; enriquecer extração com heurísticas brasileiras; manter Groq para classificação/extração por tenant; salvar metadados flexíveis no MongoDB.

**Fora de escopo (decisão de produto):** Document AI, extração de medidas/cotas em desenhos técnicos, OCR perfeito em documentos ilegíveis.

**Stack:** `pdf-parse` → fallback **Vision API** → **heurísticas** → **Groq** → MongoDB (`metadata` + `discoveredMetadata`).

---

## Convenções

| Item | Padrão |
|------|--------|
| Nomenclatura de fase | B.7, B.8, … (continua Fase B) |
| Testes de auditoria | `tests/phase-b-vision-*.test.ts` |
| Script de validação | `deploy/scripts/validate-vision-ready.sh` (a partir de B.7) |
| Credenciais GCP | `GOOGLE_APPLICATION_CREDENTIALS` — **nunca** commitar JSON na raiz |
| Provider switch | `DOCUMENT_ANALYSIS_PROVIDER=groq` (mantido); OCR é camada separada |

---

## Visão do pipeline final

```
Upload (PDF / imagem)
    │
    ├─ PDF digital → pdf-parse (grátis)
    │
    └─ Pouco texto / imagem / escaneado
           → Vision API (documentTextDetection)
           → opcional: recorte carimbo (desenho técnico)
    │
    brazilianEntityScanner (CNPJ, CPF, datas, valores)
    │
    Groq (classificação + campos da regra do tenant)
    │
    enrichMetadataWith*Heuristics (complemento)
    │
    confirm-analysis → MongoDB
        metadata          (campos da regra)
        discoveredMetadata (extras não padronizados)
        metadataIndex     (só campos buscáveis)
```

---

## Fase B.7 — Fundação GCP e serviço Vision OCR

### Entregas

1. **Segurança de credenciais**
   - Adicionar `*.json` de service account ao `.gitignore` (padrão `*-*.json` na raiz ou lista explícita)
   - Documentar `GOOGLE_APPLICATION_CREDENTIALS` em `.env.example`
   - Remover/mover JSON da raiz para path fora do repo em dev

2. **Dependência**
   - `@google-cloud/vision` no `package.json`

3. **Módulos server**
   - `server/ai/vision/visionConfig.ts` — flags, limites, região
   - `server/ai/vision/visionOcrService.ts` — `ocrImageBuffer()`, `ocrPdfPages()`
   - `server/ai/vision/visionTypes.ts` — tipos normalizados (`OcrPageText`, `OcrResult`)

4. **Integração mínima**
   - `server/ai/services/documentTextExtractor.ts` — facade unificada:
     - PDF → `extractTextFromPdf`
     - se `charCount < MIN_TEXT_CHARS` e `VISION_OCR_ENABLED=true` → Vision
   - Reutilizar `server/preview/pdfPageRenderer.ts` para rasterizar páginas PDF antes do OCR

5. **Env**
   ```env
   VISION_OCR_ENABLED=false
   GOOGLE_APPLICATION_CREDENTIALS=
   VISION_OCR_MAX_PAGES=20
   VISION_OCR_MIN_TEXT_CHARS=300
   ```

6. **Health**
   - Incluir `visionOcr` em `/api/health` (configured / disabled)

### Auditoria B.7

| # | Verificação | Como |
|---|-------------|------|
| 1 | JSON de credenciais não está no git | `git status` + grep no repo |
| 2 | `.env.example` documenta variáveis Vision | `tests/phase-b-vision-foundation.test.ts` |
| 3 | `visionOcrService` existe e exporta OCR | teste estático |
| 4 | `documentTextExtractor` faz cascata pdf-parse → Vision | teste estático |
| 5 | Health reporta status Vision | `tests/phase-a-health.test.ts` estendido ou fase B.7 |
| 6 | `VISION_OCR_ENABLED=false` não quebra fluxo atual | `npm run test:phase` |

**Comando:**
```bash
npx tsx --test tests/phase-b-vision-foundation.test.ts
./deploy/scripts/validate-vision-ready.sh --check  # stub OK nesta fase
```

**Critério de saída:** PDF digital continua igual; com Vision ligado localmente, PDF escaneado de teste retorna texto (teste manual ou integração mockada).

---

## Fase B.8 — Cascata OCR em produção e controle de custo

### Entregas

1. **Política de cascata**
   - Só chama Vision quando `extracted.charCount < VISION_OCR_MIN_TEXT_CHARS`
   - Limite de páginas: `VISION_OCR_MAX_PAGES` (primeiras N páginas)
   - Log estruturado: `ocrFallbackUsed`, `ocrPagesProcessed`, `ocrDurationMs`

2. **Métricas** (Prometheus, se observabilidade ativa)
   - `doqyn_vision_ocr_requests_total`
   - `doqyn_vision_ocr_pages_total`
   - `doqyn_vision_ocr_failures_total`

3. **Erros**
   - `VISION_OCR_FAILED` — fallback para `requires_review` com metadados mínimos (não 500)
   - Mensagem UX alinhada a `bulkFileValidation.ts`

4. **Deploy**
   - `setup-production-env.sh` gera vars Vision (disabled por padrão)
   - Volume/secret para credenciais GCP no compose (opcional B.8 ou B.12)

### Auditoria B.8

| # | Verificação | Como |
|---|-------------|------|
| 1 | Cascata só dispara abaixo do threshold | unit test com mock |
| 2 | Limite de páginas respeitado | unit test |
| 3 | Métricas registradas | teste estático prometheus |
| 4 | Falha Vision → requires_review, não crash | unit test |
| 5 | PDF digital não chama Vision | unit test |

**Comando:**
```bash
npx tsx --test tests/phase-b-vision-cascade.test.ts
```

**Critério de saída:** foto de PDF / scan de teste passa da etapa `INSUFFICIENT_TEXT` com Vision ligado.

---

## Fase B.9 — Upload e análise de imagens

### Entregas

1. **MIME types**
   - `server/ai/constants.ts` — `image/jpeg`, `image/png`, `image/webp`
   - `analysisStagingUploadService.ts` — validação de imagem
   - `uploadConstants.ts` (UI) — dropzone aceita imagens

2. **Generalização do serviço**
   - Renomear ou encapsular: `analyzeDocumentBuffer()` (PDF + imagem)
   - API mantém rotas `analyze-pdf` (alias) + documentação
   - `validatePdfUpload` → `validateAnalysisUpload`

3. **Fluxo imagem**
   - Imagem → Vision OCR direto (sem pdf-parse)
   - Mesmo pipeline Groq + confirm

4. **Preview**
   - Já existe — validar que confirm-analysis agenda preview para imagem

5. **Bulk queue**
   - `bulkFileValidation.ts` — mensagens para imagem

### Auditoria B.9

| # | Verificação | Como |
|---|-------------|------|
| 1 | UI aceita JPG/PNG/WebP | teste estático uploadConstants |
| 2 | API staging aceita imagem | teste estático |
| 3 | analyze pipeline trata image/* | teste estático + integração |
| 4 | Preview worker processa imagem após confirm | teste existente preview |
| 5 | Assinatura continua PDF-only | teste regressão |

**Comando:**
```bash
npx tsx --test tests/phase-b-vision-images.test.ts
```

**Critério de saída:** upload de JPG → análise → confirm → preview na biblioteca.

---

## Fase B.10 — Scanner de entidades brasileiras (heurísticas)

### Entregas

1. **Módulo**
   - `server/ai/heuristics/brazilianEntityScanner.ts`
     - CNPJ (regex + dígito verificador — reutilizar validadores)
     - CPF
     - Datas (`DD/MM/YYYY`, extenso opcional)
     - Valores monetários (`R$`, normalização)
     - E-mail, telefone, CEP (opcional)

2. **Tipos**
   - `ScannedEntity { type, value, normalizedValue, page?, snippet, confidence }`

3. **Integração**
   - Rodar após extração de texto, antes do Groq
   - Resultado anexado ao contexto do classificador e extrator

4. **Expandir heurísticas existentes**
   - `partyMetadataHeuristics.ts` — reusar padrões
   - Novo: `titleBlockHeuristics.ts` (prep B.11)

5. **Pós-Groq**
   - `enrichMetadataFromScannedEntities()` — preenche campos da regra quando Groq deixou vazio e entity bate com `field.key` (ex.: `cnpj_emitente`)

### Auditoria B.10

| # | Verificação | Como |
|---|-------------|------|
| 1 | CNPJ válido/inválido detectado corretamente | `tests/brazilian-entity-scanner.test.ts` |
| 2 | Datas e valores normalizados | unit tests |
| 3 | Scanner integrado em analyzePdfService | teste estático |
| 4 | Entities passadas ao prompt Groq | teste estático extractorPrompt |
| 5 | Enriquecimento pós-Groq não sobrescreve manual | unit test |

**Comando:**
```bash
npx tsx --test tests/brazilian-entity-scanner.test.ts
npx tsx --test tests/phase-b-vision-heuristics.test.ts
```

**Critério de saída:** NF de teste com CNPJ e valor no texto → campos preenchidos mesmo com Groq mockado vazio.

---

## Fase B.11 — Groq enriquecido e metadados descobertos (MongoDB)

### Entregas

1. **Prompts**
   - `classifierPrompt.ts` — incluir lista de entidades encontradas
   - `extractorPrompt.ts` — idem + instrução para não inventar
   - Opcional: Groq sugere `suggestedExtras[]` no JSON de resposta

2. **Schema MongoDB**
   - `MongoDocumentVersion.discoveredMetadata?: Record<string, MongoVersionMetadataField>`
   - `source`: `'ai' | 'document_text' | 'manual' | 'heuristic' | 'discovered'`
   - `MongoDocument.currentDiscoveredPreview?` — opcional, para UI

3. **Persistência**
   - `confirmAnalysisService.ts` — salvar `discoveredMetadata`
   - Entidades do scanner que não mapeiam a campo da regra → `discoveredMetadata`
   - `metadataIndex` — apenas campos da regra (não indexar tudo)

4. **UI (mínimo)**
   - Review drawer: seção "Informações adicionais detectadas" (colapsável)
   - Biblioteca: `currentMetadataPreview` continua com campos da regra

5. **Version update**
   - `analyzePdfUpdateService` + `compareDocumentVersions` — incluir `discoveredMetadata` no diff

### Auditoria B.11

| # | Verificação | Como |
|---|-------------|------|
| 1 | Tipo `discoveredMetadata` em types.ts | teste estático |
| 2 | confirm-analysis persiste discovered | teste integração |
| 3 | metadataIndex não explode com extras | teste unitário |
| 4 | Diff de versão lista novos discovered | teste versionComparison |
| 5 | UI review mostra seção extras | teste estático componente |

**Comando:**
```bash
npx tsx --test tests/phase-b-vision-discovered-metadata.test.ts
```

**Critério de saída:** documento com CNPJ no texto mas sem campo na regra → aparece em discoveredMetadata.

---

## Fase B.12 — Carimbo de desenho técnico (title block)

### Entregas

1. **Detecção de categoria**
   - Usar `documentClassHeuristics` / keywords do tenant ("desenho", "técnico", "projeto")

2. **Recorte opcional**
   - `server/ai/heuristics/titleBlockCrop.ts` — região inferior direita (~25% largura × ~20% altura)
   - OCR na região recortada primeiro; se falhar, página inteira

3. **Parser**
   - `titleBlockHeuristics.ts` — padrões: `DESENHO:`, `Nº`, `REV`, `ESCALA`, `MATERIAL`, `DATA`
   - Mapeamento para keys comuns: `numero_desenho`, `revisao`, `escala`, `titulo_desenho`

4. **Expectativa**
   - Sem medidas/cotas/geometria
   - `requires_review` se carimbo ilegível

### Auditoria B.12

| # | Verificação | Como |
|---|-------------|------|
| 1 | Crop gera buffer menor que página full | unit test |
| 2 | Parser extrai campos de texto carimbo sintético | unit test |
| 3 | Categoria desenho ativa pipeline carimbo | teste estático |
| 4 | Não roda crop em contrato/NF | unit test |

**Comando:**
```bash
npx tsx --test tests/title-block-heuristics.test.ts
npx tsx --test tests/phase-b-vision-title-block.test.ts
```

**Critério de saída:** PDF de desenho com carimbo legível → `numero_desenho` + `revisao` na metadata ou discovered.

---

## Fase B.13 — Atualização de versão jurídica (diff reforçado)

### Entregas

1. **OCR em update**
   - `analyzePdfUpdateService` usa mesma cascata `documentTextExtractor`
   - Páginas novas em aditivo escaneado → Vision

2. **Diff**
   - `compareDocumentVersions` — metadata + discoveredMetadata
   - `metadataUpdateExtractorAgent` — prompt com diff de entidades escaneadas

3. **UI**
   - Update version drawer — destacar campos alterados/adicionados/removidos
   - Risk warnings para cláusulas críticas (já parcial em versionComparison)

### Auditoria B.13

| # | Verificação | Como |
|---|-------------|------|
| 1 | Update usa cascata OCR | teste estático |
| 2 | Diff inclui discovered | unit test |
| 3 | Groq update recebe entities | teste estático |
| 4 | Fluxo assinatura não quebra | regressão document-signature |

**Comando:**
```bash
npx tsx --test tests/phase-b-vision-version-update.test.ts
npx tsx --test tests/document-update-version-ui.test.ts
```

**Critério de saída:** aditivo escaneado → novos metadados + diff visível vs v1.

---

## Fase B.14 — Deploy, validação e operação

### Entregas

1. **`deploy/scripts/validate-vision-ready.sh`**
   - Credenciais presentes (se enabled)
   - Vision API acessível (ping leve ou dry-run)
   - Vars no `.env` deploy

2. **`deploy/scripts/setup-production-env.sh`**
   - Bloco Vision OCR

3. **`docs/DEPLOY_VPS.md`**
   - Seção Vision: custo, cascata, quando ligar

4. **Implementar stub** `googleVisionDocumentAnalysisProvider` → renomear conceito:
   - OCR = Vision service
   - Provider Groq mantido para classify/extract
   - Remover confusão `DOCUMENT_ANALYSIS_PROVIDER=google_vision` ou documentar que OCR ≠ provider

5. **Quota / billing guard**
   - `VISION_OCR_MAX_PAGES_PER_DAY` opcional por tenant (futuro)
   - Log de custo estimado por job

### Auditoria B.14 (auditoria final)

| # | Verificação | Como |
|---|-------------|------|
| 1 | validate-vision-ready.sh passa | script |
| 2 | compose production com env Vision | teste estático |
| 3 | Documentação DEPLOY_VPS atualizada | teste estático |
| 4 | Suite phase completa | ver abaixo |
| 5 | Build server OK | `npm run build:server` |

**Comando consolidado:**
```bash
./deploy/scripts/validate-vps-ready.sh
./deploy/scripts/validate-vision-ready.sh
npx tsx --test tests/phase-b-vision-*.test.ts
npx tsx --test tests/brazilian-entity-scanner.test.ts
npx tsx --test tests/title-block-heuristics.test.ts
npm run build:server
```

---

## Matriz de dependências

```
B.7 (fundação)
 └─ B.8 (cascata + custo)
      ├─ B.9 (imagens)
      ├─ B.10 (heurísticas)
      │    └─ B.11 (discovered + Groq)
      │         └─ B.13 (version update)
      └─ B.12 (carimbo — pode paralelo após B.10)
B.14 (deploy) — após B.8 no mínimo; ideal após B.13
```

**Ordem recomendada:** B.7 → B.8 → B.9 → B.10 → B.11 → B.13 → B.12 → B.14

(B.12 pode ser antes de B.13 se desenho técnico for prioridade de negócio.)

---

## Metadados: o que é fixo vs flexível

| Camada | Onde | Exemplos |
|--------|------|----------|
| Sistema | `MongoDocument`, `version.file` | nome, páginas, mime, sha256, datas |
| Regra do tenant | `metadata` | campos de `MongoDocumentExtractionRule.fields` |
| Descobertos | `discoveredMetadata` | CNPJ achado sem campo, labels, extras Groq |
| Busca | `metadataIndex` | subset tipado dos campos da regra |

**Não padronizar chaves entre tipos de documento** — padronizar apenas o envelope (`value`, `confidence`, `source`, `evidence`).

---

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Custo Vision em migração em massa | Cascata: só OCR se pdf-parse falhar; limite de páginas |
| OCR ruim em foto 2005 | requires_review + metadados mínimos + preview |
| Groq inventa campo | Validação + entities como hint, não verdade |
| JSON credenciais no repo | .gitignore + secret no deploy |
| Tabelas NF complexas | Beta aceita limitação; heurísticas + texto corrido |

---

## Estimativa de esforço (referência)

| Fase | Complexidade | Dependências externas |
|------|--------------|------------------------|
| B.7 | Média | Conta GCP, Vision API habilitada |
| B.8 | Baixa | — |
| B.9 | Média | — |
| B.10 | Média | — |
| B.11 | Média-alta | — |
| B.12 | Baixa-média | Amostras de carimbo |
| B.13 | Média | — |
| B.14 | Baixa | VPS para teste final |

---

## Checklist antes de começar B.7

- [ ] Vision API habilitada no projeto GCP
- [ ] Service account com role `roles/cloudvision.user`
- [ ] JSON fora do repo; path no `.env` local
- [ ] Amostras de teste: PDF digital, PDF escaneado, foto JPG, desenho com carimbo
- [ ] `GROQ_API_KEY` funcionando (inalterado)
- [ ] `npm run test:phase` verde na branch atual

---

## Após cada fase (ritual de auditoria)

1. Implementar entregas da fase
2. Rodar testes da fase (`phase-b-vision-*.test.ts`)
3. Rodar regressão: `npx tsx --test tests/phase-a-imports.test.ts` + testes de documento existentes
4. Atualizar este doc marcando fase concluída (data + notas)
5. Só então iniciar próxima fase

**Registro de progresso:**

| Fase | Status | Data | Notas |
|------|--------|------|-------|
| B.7 | concluída | 2026-07-12 | Foundation + auditoria + `AI_PIPELINE_DEBUG` (logs TEMP) + Groq Scout 17B |
| B.8 | concluída | 2026-07-12 | Cascata + métricas Prometheus + VISION_OCR_FAILED→requires_review + volume secrets |
| B.9 | concluída | 2026-07-12 | MIME JPG/PNG/WebP + OCR imagem + confirm mime dinâmico + UI dropzone |
| B.10 | pendente | | |
| B.11 | pendente | | |
| B.12 | pendente | | |
| B.13 | pendente | | |
| B.14 | pendente | | |
