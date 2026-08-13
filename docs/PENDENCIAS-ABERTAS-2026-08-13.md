# Pendências abertas — 2026-08-13

Itens levantados durante a sessão de 13/08 que **não** foram resolvidos, com evidência, motivo e
próximo passo. Escrito para ser retomado por alguém sem o contexto da sessão.

Ordem: por consequência, não por esforço.

---

## 1. `api/documents/upload.ts` cria documento que nunca passa pela IA

**Severidade: média-alta.** Depende de a UI alcançar ou não esse caminho — não confirmado.

### O que acontece

Existem dois caminhos de entrada de documento:

| Caminho | O que faz |
|---|---|
| `POST /api/ai/analyze-pdf` → confirmar | Fluxo real da UI: extrai texto, classifica, extrai metadados, depois persiste |
| `POST /api/documents/upload` | Grava direto, **sem chamar a IA** |

Pelo segundo, o documento nasce assim:

```json
{ "classId": "unclassified", "documentType": "Outro", "status": "active",
  "metadata": {}, "reviewReasons": undefined }
```

E o job correspondente sai `{"type":"legacy_upload","status":"completed","error":null}`.

### Por que importa

Nada sinaliza que a análise não ocorreu. Não há `requiresReview`, não há motivo, não há erro — o
job diz "completed". Da perspectiva do usuário, o documento simplesmente ficou como "Outro" sem
metadado, indistinguível de um documento que a IA analisou e não soube classificar.

### Como reproduzir

```bash
curl -b cookie.txt -X POST http://localhost:3001/api/documents/upload \
  -F "file=@algum.pdf;type=application/pdf"
# 201, e o documento fica classId=unclassified sem qualquer sinal
```

### Próximo passo

1. Confirmar se a UI alcança esse endpoint (grep em `src/features/upload/` por `documents/upload`).
2. Se **não** alcançar: é caminho legado — considerar removê-lo ou fazê-lo recusar.
3. Se **alcançar**: ou ele passa a enfileirar análise, ou marca `requiresReview=true` com motivo
   explícito ("documento enviado sem análise automática").

---

## 2. Teto de buckets do R2 — parede, não custo

**Severidade: alta a médio prazo.** Mesma forma de falha do teto de namespaces que o Passo 7 resolveu.

### O contexto

O desenho é: **PJ ganha bucket próprio, PF usa bucket compartilhado**. Isso está correto e é coerente
com o milestone de confidencialidade — bucket por tenant permite credencial escopada e, na fase 6,
chave de criptografia por tenant.

Financeiramente não há problema: o R2 **não cobra por bucket**. A conta é storage por GB/mês,
operações Classe A e B, e egress gratuito. Mil buckets custam o mesmo que um, para o mesmo volume.
E o custo cresce junto com a receita, que é o modelo funcionando.

### O problema

O Cloudflare limita o **número de buckets por conta**. Não confirmei o valor atual — a ordem que eu
conheço é ~1.000, elevável sob pedido, mas **isso precisa ser verificado, não assumido**.

O plano de escala mira **4.000 tenants** (`docs/PLANO_ACAO_ESCALA_2026-07-20.md`). Se o teto for
~1.000, o modelo por tenant bate na parede em 1/4 da meta.

A distinção que importa: **custo é rampa, teto é degrau.** Custo sobe junto com a receita e você paga
com o que fatura. Teto é atingido no cliente N independentemente do faturamento, e nesse dia o
cadastro de tenant novo passa a falhar.

### Próximo passo

1. Confirmar o limite de buckets da conta no painel Cloudflare ou com o suporte.
2. Se confortavelmente acima de 4.000: encerrar o assunto, registrar o número.
3. Se apertado: avaliar caminho intermediário — PJ pequeno em bucket compartilhado com prefixo por
   tenant, e bucket dedicado vira característica de plano (enterprise), não default.
4. Registrar como passo novo no plano de escala, seja qual for a conclusão.

---

## 3. Sete buckets órfãos no R2

**Severidade: baixa.** Resíduo, não risco. Mas ocupa cota do item 2.

### Estado medido (`npm run r2:audit-buckets`, somente leitura)

| Estado | Qtd | Observação |
|---|---|---|
| `ok` (referenciado pelo registry) | **1** | o único correto |
| `orphan_has_objects` | 3 | ~1 MB em 14 arquivos |
| `orphan_empty` | 4 | risco zero para apagar |
| `missing_registry` | 1 | |

Como o MongoDB foi zerado nesta sessão, **nenhum documento referencia nada disso**.

### Detalhe revelador

O bucket `doqyn-t-73dcc57ebaf7` carrega o mesmo hash do tenant `company_dev`, no padrão legado
`doqyn-t-<hash12>`. Somando com os outros dois encontrados, esse único tenant tem bucket em **três
gerações de nomenclatura**:

- `doqyn-t-73dcc57ebaf7` — legado
- `doqyn-dev-t-doqyn-dev-73dcc57ebaf7` — derivado do slug
- `doqyn-dev-t-company-dev-73dcc57ebaf7` — derivado do tenantId, o canônico atual

A correção de hoje (commit `5e6abe8`) impede a quarta geração: o nome passou a ser função pura do
`tenantId`, que o cliente não edita.

### Próximo passo

```bash
npm run r2:audit-buckets                                    # confere o estado
npm run r2:cleanup-empty-demo-buckets -- --confirm-r2-cleanup   # remove só os 4 vazios
```

O script pula deliberadamente os buckets com conteúdo. Para os 3 com objeto, listar o conteúdo antes
de decidir — provavelmente é resíduo de teste, mas isso não foi verificado arquivo a arquivo.

**Ação destrutiva e sobre serviço externo: exige confirmação explícita do usuário.**

---

## 4. Modelos de IA não avaliados

**Severidade: baixa.** Oportunidade, não defeito.

### O que já foi decidido e medido

`GROQ_CLASSIFIER_MODEL=llama-3.3-70b-versatile` (classificação) e `GROQ_MODEL=llama-3.1-8b-instant`
(extração). A separação é deliberada:

- Classe errada **zera a extração inteira**; erro de extração perde um campo.
- O OCR derruba a classificação (12/12 → 8/12 na bancada) e não afeta a extração (77% → 77%).
- Os dois campos que falhavam na extração eram formato de data e cálculo de validade, **resolvidos
  em código** (commits `b9df248` e `7c024f7`), não por modelo.
- O 70b bateu em rate limit **29 vezes** durante a bancada. Uma chamada por documento em vez de duas
  corta a exposição pela metade.

### O que falta

Dois modelos disponíveis na conta **nunca foram testados**: `openai/gpt-oss-120b` e
`qwen/qwen3.6-27b`.

```bash
BENCH_MODELS=openai/gpt-oss-120b,qwen/qwen3.6-27b BENCH_REPS=1 \
  node scripts/bench-extractor-prompts.mjs
```

A bancada (`scripts/bench-extractor-prompts.mjs`) mede classificação e extração separadamente,
com corpus de 3 documentos incluindo um **negativo** — relatório técnico avaliado contra campos de
contrato, onde a resposta certa é tudo `null`. Foi o negativo que mais separou os modelos: o prompt
mínimo no 70b inventou 12 de 12 campos.

Metodologia e armadilhas em `docs/ESTUDO-PROMPTS-EXTRACAO-2026-08-12.md`.

---

## 5. Falha intermitente de extração

**Severidade: a determinar.** Instrumentado, ainda não caracterizado.

Exercitando o fluxo real, a primeira análise do NDA devolveu **zero campos** com *"A análise
automática falhou"*. A segunda, idêntica, funcionou. O `catch {}` era vazio e descartava a causa,
tornando a falha transitória indistinguível de bug de prompt.

Corrigido no commit `938daee`: agora registra classe, contagem de campos, contagem de chunks, nome e
mensagem do erro.

### Próximo passo

Com a instrumentação no ar, verificar a frequência real:

```bash
grep "metadata extraction failed" logs/dev/api.log
```

Se for rate limit do Groq, cabe backoff no `completeJsonPrompt` — a bancada já tem essa lógica
(`scripts/bench-extractor-prompts.mjs`, função `call`) e pode servir de referência.

---

## Itens já registrados em outros documentos

Não repetidos aqui, mas seguem abertos:

| Item | Onde está |
|---|---|
| Fase 2 obrigatória — 10 operações de plataforma negadas, incluindo `anonymizeUser` (LGPD) | `.planning/phases/01-*/01-VERIFICATION.md` |
| `LAST_ADMIN_PROTECTION` inalcançável por HTTP | idem |
| Bucket `audit` da governança sem chamador | idem |
| `doqyn-auth-service` sem caminho de backup | idem |
| Placeholders de segredo no `.env.example` podem quebrar setup novo (não consigo ler `.env*`) | commit `b17a0e4` |
| Fase 8 do roadmap — 2FA por TOTP, verificação de e-mail, OAuth no cadastro | `.planning/ROADMAP.md` |
| Configuração do Microsoft OAuth pendente de diretório Entra | `docs/SETUP-MICROSOFT-OAUTH.md` |

---

## Estado do ambiente ao fim da sessão

- MongoDB `doqyn_dev` (Atlas): **zerado e recriado**, 19 coleções, zero legadas
- Postgres `doqyn_auth`: **zerado**, migrações reaplicadas, seed demo carregado
- Serviços no ar: auth `4100`, API `3001`, web `5173` — subir com `./doqyn up`
- Contas demo: `rafael.mendes@doqyn.dev` (company_admin), `camila.oliveira@`, `thiago.barros@`,
  `renata.alves@` (user) — senha `DevDoqyn@123`
- `npm test` no alpha: 1452 testes, 1431 passando, **21 falhas pré-existentes** (inspeção estática,
  deferidas por D-19) — esse é o número de referência para detectar regressão
- `npx vitest run` no auth: 211 testes, 209 passando, **2 falhas pré-existentes** nos fluxos de signup
