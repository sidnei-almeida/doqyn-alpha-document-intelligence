# Ponto de retomada — escala do envio (15/08/2026)

Trabalho parado por decisão do usuário: o gargalo virou decisão comercial (contratar plano pago da
Groq), e o resto pode esperar.

## Onde parou

Ensaio de carga com 30 envios sobre `~/Downloads/random_docs` (5 arquivos reais), 6 em paralelo,
pelo caminho HTTP real. Interrompido na metade — os números já bastavam.

| Medição | Valor |
|---|---|
| envio (upload + enfileirar) | ~1s |
| confirmação | ~20ms |
| espera na fila | 58s a 497s |
| vazão sustentada | ~3 documentos/minuto na plataforma inteira |

Praticamente todo o tempo é espera pela vazão da Groq. O plano gratuito é o teto: cada documento
gasta ~2.000 tokens na classificação (70b) e ~4.600 na extração (8b).

## A decisão que destrava

Contratar plano pago da Groq. Definido com o gestor, ainda sem plano escolhido. Ao fechar:

1. Ler os limites reais nos cabeçalhos `x-ratelimit-limit-requests` e `x-ratelimit-limit-tokens`
   de qualquer resposta da Groq — não adivinhar.
2. Ajustar `GROQ_MAX_REQUESTS_PER_MINUTE` e `GROQ_MAX_TOKENS_PER_MINUTE` (hoje 25 e 6.000, chutes
   conservadores dimensionados para o plano gratuito).
3. Só então a concorrência 8 da fila (`ANALYSIS_QUEUE_CONCURRENCY_GLOBAL`) passa a valer de verdade.

## Pendência aberta que o ensaio revelou

**Saturação degrada a qualidade, não só a velocidade.** Quando a espera pelo limitador estoura os
75s, o documento é marcado `ai_unavailable` e cai na revisão manual. Sob carga, o lote inteiro vira
trabalho humano — o oposto do objetivo.

Correção pensada e **não implementada**: o worker devolve o job para a fila (`moveToDelayed` +
`DelayedError`, mesmo mecanismo já usado para o slot de tenant) em vez de concluir o documento como
`ai_unavailable`. Assim a lentidão continua lentidão, e não vira erro na tela.

Vale mesmo com plano pago: é a diferença entre "na fila" e "deu erro" em qualquer pico.

## Resto da fila de melhorias

Ordem da auditoria (`docs/AUDITORIA-ESCALA-ENVIO-2026-08-15.md`), do que sobrou:

1. Fatiamento do PDF sai do request de confirmação (achado 3)
2. Envio sobreposto no navegador, 2–3 em voo (achado 9)
3. Recuo progressivo na consulta de status (achado 6)
4. Posição na fila e estimativa na tela (achado 10)
5. Reserva de slot de tenant com validade curta (achado 7)
6. Rate limit por usuário nas rotas caras (achado 5)

## Estado do ambiente

- `doqyn up` no ar: auth 4100, API 3001, web 5173.
- A API foi subida à mão com `ANALYSIS_SYNC_FALLBACK=false` e o worker de análise com
  `ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=8` — nenhum dos dois sobrevive a um `./doqyn down`.
- O banco de desenvolvimento tem documentos do ensaio (cópias de `carga-N-<arquivo>`) e alguns
  `requires_review` sem classe. Lixo de teste, não foi limpo.
