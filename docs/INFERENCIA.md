# Inferência: Groq e Fireworks

Como o pipeline de IA escolhe o fornecedor de LLM, quais limites valem em cada um e o que foi
medido na troca para o Fireworks (setembro de 2026).

## Dois eixos, não um

| Variável | Pergunta que responde | Valores |
|---|---|---|
| `DOCUMENT_ANALYSIS_PROVIDER` | Qual **pipeline** analisa o documento | `groq` (classificação + extração com LLM), `google_vision` |
| `INFERENCE_PROVIDER` | Contra qual **API** o pipeline de LLM fala | `groq` (padrão), `fireworks` |

Trocar de fornecedor de inferência não troca a arquitetura: o mesmo cliente (`groq-sdk`) atende os
dois, porque o Fireworks expõe a API no formato da OpenAI. O limitador de vazão, a repetição de
JSON inválido, o orçamento de tokens e o tratamento de saturação continuam valendo.

## Ligar o Fireworks

```env
INFERENCE_PROVIDER=fireworks
FIREWORKS_API_KEY=            # chave fw_..., nunca em arquivo versionado
```

Opcionais, com os padrões do código:

| Variável | Padrão |
|---|---|
| `FIREWORKS_BASE_URL` | `https://api.fireworks.ai/inference/v1` |
| `FIREWORKS_MODEL` | `accounts/fireworks/models/gpt-oss-120b` |
| `FIREWORKS_CLASSIFIER_MODEL`, `FIREWORKS_EXTRACTOR_MODEL`, `FIREWORKS_EVALUATOR_MODEL` | valor de `FIREWORKS_MODEL` |

Com `INFERENCE_PROVIDER=fireworks`, as variáveis `GROQ_*_MODEL` são ignoradas: o mesmo modelo tem
ID diferente em cada fornecedor (`openai/gpt-oss-120b` na Groq).

Voltar para a Groq é apagar a linha `INFERENCE_PROVIDER`.

### O prefixo `/openai/v1`

O `groq-sdk` escreve o caminho da Groq por extenso (`/openai/v1/chat/completions`) e só deixa trocar
o host. Com a base do Fireworks a chamada virava `/inference/v1/openai/v1/chat/completions` e
voltava 404. O cliente remove esse prefixo quando há `baseURL` própria
(`stripGroqPathPrefix` em `server/ai/services/groqClient.ts`). Um teste com `curl` direto na API não
detecta esse problema, porque não passa pelo SDK — o teste que vale é o pipeline real.

## Limitador de vazão

O limitador usa os nomes `GROQ_*` para os dois fornecedores e conta por ID de modelo.

A ordem de precedência é: valor no `.env` → limite informado em cabeçalho pela última resposta →
padrão conservador (25 pedidos e 6.000 tokens por minuto). A Groq manda
`x-ratelimit-limit-requests` e `x-ratelimit-limit-tokens`; **o Fireworks não manda** (só
`x-ratelimit-over-limit`). Sem valor no `.env`, o Fireworks roda preso ao teto do plano gratuito da
Groq.

A conta do Fireworks tem quota de 20.000 pedidos por minuto em serverless e nenhuma quota de tokens
por minuto. O limitador continua útil como freio contra loop, com teto muito acima do uso real:

```env
GROQ_MAX_REQUESTS_PER_MINUTE=3000
GROQ_MAX_TOKENS_PER_MINUTE=3000000
GROQ_REQUEST_TIMEOUT_MS=45000        # o código limita entre 10 e 45 s
```

No compose de produção, `GROQ_MAX_REQUESTS_PER_MINUTE` e `GROQ_MAX_TOKENS_PER_MINUTE` têm padrão
próprio (25 e 20.000) aplicado sempre que a variável falta no `deploy/.env`. Por isso elas precisam
estar escritas lá.

## Limites de leitura e de arquivo

Os tetos antigos eram o rate limit do plano gratuito da Groq, não um limite do modelo. O modelo não
lê o texto inteiro: classificador e extrator recebem só os trechos selecionados, e o restante vira
busca e embedding.

| Limite | Plano gratuito da Groq | Agora |
|---|---|---|
| `PDF_ANALYSIS_MAX_PAGES` | 10 a 30 | 300 |
| `PDF_ANALYSIS_MAX_INPUT_CHARS` | 30.000 | 1.000.000 |
| `EXTRACTION_MAX_CHUNKS` | 8 a 20 | 40 |
| `GROQ_MAX_TOKENS_PER_MINUTE` | 8.000 | 3.000.000 |
| Tamanho de arquivo (tela, IA, `MAX_UPLOAD_MB`) | 15 MB / 25 MB | 50 MB |
| `client_max_body_size` (nginx) | 30m | 60m |

Acima desses valores quem pesa é a memória dos containers (1 GB para API e worker no compose de
produção), não a inferência. `VISION_OCR_MAX_PAGES` (OCR do Google Vision) é outro custo, cobrado
por página, e não mudou.

## Refino da extração

`EXTRACTION_REFINEMENT_ENABLED` liga um laço que avalia a extração e, se faltar campo, relê o
documento com foco nos campos ausentes (`EXTRACTION_REFINEMENT_MAX_PASSES`,
`EXTRACTION_TOKEN_BUDGET_PER_DOCUMENT`).

Medição de 14/09/2026, Fireworks com `gpt-oss-120b`, 21 PDFs digitais do conjunto difícil (1 a 2
páginas cada), um documento por vez:

| | Refino desligado | Refino ligado |
|---|---|---|
| Tempo médio por documento | 5,9 s | 8,9 s |
| Documento mais lento | 8,2 s | 15,8 s |
| Campos corretos | 43/49 | 42/49 |
| Erros de API ou espera no limitador | 0 | 0 |

Com o refino ligado, o avaliador rodou em 18 documentos e não pediu nenhuma releitura focada. A
diferença de um campo provavelmente é a variação conhecida do modelo entre rodadas, e não efeito do
refino; uma rodada só não separa as duas coisas.
No plano gratuito da Groq o refino esbarrava na cota por minuto; no Fireworks ele roda sem espera,
mas não mostrou ganho nesse conjunto.

**Decisão:** refino desligado por padrão. Ele volta a ser avaliado com documentos longos, onde a
seleção de trechos deixa parte do texto de fora e a releitura focada pode encontrar o que faltou.

### Onde o tempo vai

Com o refino desligado, média por documento:

| Etapa | Tempo |
|---|---|
| Extração de texto | 0,2 s |
| Classificação (1 chamada ao LLM) | 1,8 s |
| Extração de metadados (1 chamada ao LLM) | 3,4 s |
| **Total** | **5,7 s** |

As duas chamadas ao modelo somam mais de 90% do tempo. A avaliação acima processa um documento por
vez; no app, o worker analisa até `ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT` documentos em paralelo por
tenant (padrão 2, recomendado 4 com o Fireworks).

## Checklist de produção

No `deploy/.env` da VPS:

```env
INFERENCE_PROVIDER=fireworks
FIREWORKS_API_KEY=
GROQ_MAX_REQUESTS_PER_MINUTE=3000
GROQ_MAX_TOKENS_PER_MINUTE=3000000
GROQ_REQUEST_TIMEOUT_MS=45000
PDF_ANALYSIS_MAX_PAGES=300
PDF_ANALYSIS_MAX_INPUT_CHARS=1000000
EXTRACTION_MAX_CHUNKS=40
EXTRACTION_REFINEMENT_ENABLED=false
ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT=4
MAX_UPLOAD_MB=50
```

Depois, recriar `doqyn-api` e `doqyn-worker` (as variáveis só entram na criação do container) e
reconstruir o `nginx` para o novo `client_max_body_size`.
