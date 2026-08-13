# Auditoria — modelo e engenharia do MongoDB

**Data:** 2026-08-13 · **Contra:** `docs/PLANO_ACAO_ESCALA_2026-07-20.md` · **Banco:** `doqyn_dev` (Atlas)

Verificação do que o plano de escala marca como aplicado, conferido no código **e** no banco real.

## Passos 1 a 7 — o que o plano marca como feito

| Passo | Marcado | Verificado |
|---|---|---|
| 3 — índice `companyId` | ✓ | ✓ `tenantIndexes.ts:219`, com `partialFilterExpression` |
| 4 — cache do registro de tenant | ✓ | ✓ `tenantResolver.ts:119-131` via `tenantRegistryCache` |
| 5 — dashboard sem varredura | ✓ | ✓ `$facet` em `dashboardOverviewService` e `trackingSummaryService` |
| 6 — teto de bytes e ordem de quota | ✓ | ✓ `parseMultipart.ts` + `api/documents/upload.ts` |
| 7 — modelo de coleções compartilhadas | ✓ | ✓ `tests/shared-collection-model.test.ts`, 7 testes passando |

**Passo 7 está de fato aplicado.** Provisionar tenant novo não cria namespace: o teste prova que mil
tenants resolvem para as mesmas 10 coleções, e os dados nas coleções antigas datam de **2026-07-18**,
anteriores ao corte de 2026-08-10.

## Achado 1 — 56 coleções legadas com 195 documentos

O corte do Passo 7 foi "seco, sem migração": o código parou de usar as coleções por tenant, mas elas
**nunca foram removidas**.

```
BASE (13):    audit_logs, documents, document_chunks, document_groups, ...
LEGADO (56):  audit_logs_company_alpha_consultoria, document_categories_company_dev, ...
              195 documentos ainda dentro
```

Três consequências:

1. **Namespaces consumidos à toa.** O teto do Atlas M0 era justamente o motivo do Passo 7; 56 dos
   ~100 disponíveis seguem ocupados por coleção que ninguém lê.
2. **Dados invisíveis.** Os 195 documentos existem e nenhuma consulta os alcança. Quem criou aquilo
   em julho acha que sumiu.
3. **Ruído de auditoria.** Qualquer contagem de coleções ou relatório de schema mede 69 em vez de 13.

`npm run db:drop-empty-legacy` existe, mas só remove coleção **vazia** — estas têm conteúdo.
Zerar o banco resolve, e é o caminho natural em pré-lançamento.

## Achado 2 — o teste-guarda tem ponto cego

`tests/shared-collection-model.test.ts` afirma *"todo índice de dado de tenant lidera por tenantId"*.
Ele passa. Mas lê **um arquivo só**:

```js
const indexes = read('server/db/tenantIndexes.ts');
const specs = indexes.slice(specsStart, specsEnd);   // só tenantScopedIndexSpecs
```

Ficam de fora seis arquivos que também definem índice de dado de tenant:

- `documentShareGrantsIndexes.ts`
- `externalDocumentShareGrantsIndexes.ts`
- `documentSignatureIndexes.ts`
- `documentExpiryAlertIndexes.ts`
- `documentUploadApprovalIndexes.ts`
- `userDocumentFavoritesIndexes.ts`

O teste dá uma garantia mais estreita do que o nome promete. Não é falso — é incompleto, e o nome
esconde a incompletude.

## Achado 3 — os 33 índices fora do padrão, triados

O banco tem 33 índices não liderados por `tenantId`. **A maioria está correta**, e vale separar:

**Legítimos — quem consulta não tem contexto de tenant** (parte externa chega só com um token):

```
document_signature_requests  { signatureTokenHash }        unique
external_document_share_grants { inviteTokenHash }         unique
document_signatures          { verificationCode }
document_signatures          { signatureId }, { signatureRequestId }
```

**Legítimos — coleções de registro, não de dado de tenant:**

```
tenants        { slug }, { taxIdHash }, { status }, { tenantType, status }, { companyId }
tenant_members { authUserId, status }
```

**Legítimos — busca por identificador globalmente único.** `documentId` tem prefixo (`doc_…`) e é
único no pool inteiro, então o índice é seletivo mesmo sem `tenantId`; o escopo de tenant vem do
filtro da consulta, não do índice.

**Inconsistência real — nome de campo divergente:**

```
document_share_grants          { documentTenantId, sharedWithUserId, status }
external_document_share_grants { documentTenantId, status }
document_signature_requests    { documentTenantId, status }
```

Estes **são** liderados por tenant — só que sob o nome `documentTenantId` em vez de `tenantId`. O
efeito de índice é o mesmo; o custo é humano: `assert-no-flat-tenant-writes`, o teste-guarda e
qualquer auditoria futura procuram `tenantId` e não enxergam estes. Dois nomes para o mesmo conceito
é dívida de modelagem, não de performance.

**O único que merece revisão de verdade:**

```
document_expiry_alerts { documentId, userId, offsetDays }
```

Sem `tenantId` em nenhuma posição. Funciona porque `documentId` é único, mas é a única coleção de
dado de tenant sem qualquer prefixo de tenant nos índices — e alerta de vencimento é justamente o
tipo de consulta que roda em lote, varrendo por data.

## Recomendações

| # | Ação | Quando |
|---|---|---|
| 1 | Zerar o banco, eliminando as 56 coleções legadas | agora, pré-lançamento |
| 2 | Ampliar o teste-guarda para os seis arquivos de índice | junto com 1 |
| 3 | Unificar `documentTenantId` → `tenantId` | precisa migração; avaliar antes do lançamento |
| 4 | Avaliar `{ tenantId, ... }` em `document_expiry_alerts` | com o 3 |

Os Passos 8 a 12 do plano seguem abertos por decisão — não são regressão.

## Como reproduzir

```bash
npm run audit:mongodb-schema      # relatório completo de schema
npm run audit:collection-usage    # onde cada coleção é lida/escrita
MONGODB_DATABASE=doqyn_test npx tsx --test tests/shared-collection-model.test.ts
```
