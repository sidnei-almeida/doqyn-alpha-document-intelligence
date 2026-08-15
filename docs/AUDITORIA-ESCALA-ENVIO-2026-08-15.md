# Auditoria — envio em lote e comportamento sob carga

Data: 2026-08-15. Escopo: caminho de envio de documento (individual e em lote), do navegador até o
documento salvo, com foco em o que acontece quando muitos usuários enviam ao mesmo tempo.

Os tempos abaixo são medidos no ambiente de desenvolvimento com Atlas remoto, num PDF de 3 páginas
e 78 KB, não estimados.

## Como o envio funciona hoje

```
navegador
  POST /api/ai/analyze-pdf        multipart, arquivo inteiro pelo processo da API
    ├─ fila ligada  → 202 + jobId, worker analisa, navegador consulta a cada 2s
    └─ fila off     → analisa dentro do request (padrão em desenvolvimento)
  POST /api/documents/confirm-analysis
      baixa do staging, grava no destino, fatia em trechos, grava documento/versão/trechos,
      agenda preview, enfileira vetorização                        ~4,4s
```

| Etapa | Tempo medido |
|---|---|
| extração de texto | 23–46ms |
| carga de regras | 53–56ms |
| classificação (Groq) | 832–1062ms |
| extração de metadados (Groq) | 1152–1220ms |
| **análise total** | **2,0–2,4s** |
| **confirmação** | **4,4s** |

Dois fatos que orientam tudo que vem a seguir: a análise é **95% espera de rede** na Groq, quase
nada de CPU; e a confirmação custa **o dobro** da análise, dentro do request HTTP.

## Achados

Ordem por impacto sob carga. "Custo" é o que o usuário sente.

### 1. Teto de 2 análises simultâneas em toda a plataforma — CRÍTICO

`ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=2` e um único container `doqyn-worker`
(`deploy/docker-compose.production.yml`). Com 2,2s por documento, o teto é ~55 documentos por
minuto **somando todos os tenants**.

300 pessoas enviando 10 documentos cada = 3000 documentos = **~55 minutos** de fila. O último da
fila fica quase uma hora vendo "Analisando com IA…".

O número 2 foi escolhido para trabalho de CPU (o comentário no arquivo diz "2 vCPU, oversubscription
de 5x"). Mas a análise não é CPU: são ~2,1s dos 2,2s parados esperando a Groq responder. Um worker
Node aguenta dezenas dessas em paralelo sem tocar no processador.

**Correção:** subir `ANALYSIS_QUEUE_CONCURRENCY_GLOBAL` para a faixa de 8–12 e medir; o limite real
passa a ser a conta da Groq (achado 2), não o container.

### 2. Nenhum controle de vazão para a Groq — CRÍTICO

Existe tratamento de 429 por requisição (respeita `retry-after`, tenta de novo, e marca o documento
como `ai_paused`), mas não existe limitador global: nada impede N workers dispararem juntos e
estourarem o limite da conta.

Hoje isso não aparece porque o teto de 2 (achado 1) segura por acidente. Subir a concorrência sem
resolver isto troca "fila lenta" por "IA indisponível" na tela de muita gente ao mesmo tempo — que
é pior, porque o documento cai em `ai_paused` e exige ação manual.

**Correção:** limitador de vazão compartilhado no Redis (janela deslizante por minuto, dimensionado
pelo plano da Groq), aplicado antes de cada chamada. Quando estourar, o job espera na fila em vez de
falhar para o usuário.

### 3. Confirmação faz trabalho pesado dentro do request — ALTO

`confirmAnalysisPersistence` baixa o arquivo do staging para a memória do processo da API, grava no
destino, **fatia o PDF em trechos** (`pdf-parse`, CPU) e grava tudo. São os 4,4s medidos, no
processo que atende todas as outras telas.

Sob carga isso é duplamente ruim: cada confirmação simultânea segura até 25 MB de arquivo na memória
de um container de 1 GB, e o fatiamento bloqueia o event loop — enquanto ele roda, nenhuma outra
requisição é atendida.

**Correção:** manter no request só o que o usuário precisa para ver o documento salvo (gravar
arquivo e documento) e mover o fatiamento para a fila, junto da vetorização que já roda lá.

### 4. O arquivo inteiro atravessa a API — ALTO

`VITE_PRESIGNED_UPLOAD_ENABLED` está `false` por padrão no compose de produção (o script de setup e
o `.env.production.example` colocam `true`, então o valor efetivo depende de qual caminho foi usado
no deploy — **precisa ser conferido no VPS**).

Com `false`, todo byte passa por nginx e pelo processo da API. 300 pessoas × 25 MB = 7,5 GB
trafegando por um processo com 0,8 vCPU e 1 GB, que também responde o resto do produto. Com `true`,
o navegador envia direto para o R2 e a API recebe só um `jobId`.

**Correção:** confirmar `VITE_PRESIGNED_UPLOAD_ENABLED=true` em produção. É a mudança de maior
efeito por menor esforço da lista.

### 5. Sem limite de requisições por usuário, e quota desligada — ALTO

Não existe rate limit HTTP em nenhuma rota. A quota por tenant existe
(`TENANT_QUOTA_ANALYSIS_PER_DAY=200`, `TENANT_QUOTA_UPLOADS_PER_HOUR=60`) mas **nasce desligada**:
`TENANT_QUOTA_ENABLED` sem valor = `false`.

Um cliente com script, ou um bug de retry no navegador, satura a plataforma inteira — não só a
própria conta.

**Correção:** ligar `TENANT_QUOTA_ENABLED=true` (precisa Redis, que já existe) e acrescentar rate
limit por usuário nas rotas caras: `analyze-pdf`, `confirm-analysis`, `upload-url`.

### 6. Consulta de status a cada 2 segundos, sem folga — MÉDIO

`pollAnalysisJobResult` usa `pollIntervalMs = 2000` fixo, sem recuo progressivo e sem dispersão.
Cada consulta é uma requisição autenticada com uma leitura no Mongo.

300 usuários com um documento em andamento = **150 requisições por segundo** só de "já terminou?",
no mesmo processo que precisa atender os envios. E como todos entram na fila juntos, as consultas
tendem a sincronizar em ondas.

**Correção:** recuo progressivo (2s nas primeiras tentativas, subindo até 8–10s) com dispersão
aleatória. Um passo adiante seria empurrar o resultado por SSE em vez de consultar.

### 7. Fila de tenant pode ficar travada se o worker morrer — MÉDIO

`tryAcquireTenantAnalysisSlot` incrementa um contador no Redis e o `finally` do job decrementa. Se o
processo morrer no meio (OOM, restart, deploy), o decremento não acontece. A chave tem validade de 2
horas, mas ela é **renovada a cada nova tentativa de reserva** — ou seja, um tenant ativo pode ficar
com o contador preso por tempo indefinido, e todo documento dele fica esperando um slot que nunca
volta.

**Correção:** trocar o contador por reserva com dono e validade curta (chave por job, renovada
enquanto o job vive), de modo que a morte do worker libere o slot sozinha.

### 8. Soma de CPU dos containers é o dobro do VPS — MÉDIO

Somando os limites do compose: postgres 0,5 + pgbouncer 0,1 + auth 0,5 + redis 0,3 + api 0,8 +
índices 0,5 + worker 0,8 + preview 0,6 + nginx 0,2 = **4,3 vCPU**, num plano descrito como 2 vCPU.

Não quebra nada por si — o Docker só limita o teto, não reserva —, mas significa que sob pico todo
mundo disputa, e a latência da API sobe junto com o trabalho do worker. Com o embedding agora
morando no worker de análise (CPU-bound de verdade), a disputa piora.

**Correção:** decidir a prioridade explicitamente. O caminho que o usuário sente é API e auth; o
worker pode ficar com teto menor e recuperar vazão por concorrência (achado 1), que é espera de
rede, não CPU.

### 9. O navegador envia um arquivo por vez — MÉDIO (percepção)

Tanto a fila da Biblioteca (`UploadQueueProvider.pumpQueue`) quanto a de lote
(`useBulkUploadQueue`, `concurrency: 1`) processam estritamente um item por vez: envia, espera a
análise inteira, confirma, e só então começa o próximo.

Para um lote de 20 arquivos são 20 × (envio + 2,2s + 4,4s) em série — perto de 3 minutos com a
plataforma vazia, sem contar fila. O servidor está ocioso durante boa parte disso.

**Correção:** sobrepor etapas — enviar o próximo enquanto o atual analisa, com 2–3 em voo. Mexe só
no cliente e é o ganho mais visível para quem manda lote.

### 10. A tela não diz onde o documento está na fila — MÉDIO (percepção)

Em espera, o item mostra "Analisando com IA…" independente de estar sendo processado agora ou ser o
número 400 da fila. Sem posição nem estimativa, uma espera longa é indistinguível de travamento — é
quando o usuário recarrega a página e reenvia, aumentando a carga.

**Correção:** devolver posição na fila e estimativa junto do status do job, e mostrar no item.

### 11. Falha ao gravar trechos é engolida — BAIXO

`persistChunksAfterVersionConfirm` captura qualquer erro e só registra em log. Foi o que escondeu o
bug de `chunkIndex` corrigido hoje (`b8f7e66`): documentos gravados pela metade, sem sinal nenhum.

Tolerar a falha está certo — o documento não deve deixar de ser salvo porque o RAG falhou —, mas
precisa deixar rastro visível.

**Correção:** métrica Prometheus de falha de fatiamento e um campo no documento indicando que os
trechos estão pendentes, para reprocessar.

### 12. Preview com concorrência 1 e Ghostscript — BAIXO

`PREVIEW_QUEUE_CONCURRENCY_GLOBAL=1` com Ghostscript, que é CPU de verdade. Sob lote, a miniatura
demora a aparecer. Menos grave porque o documento já está salvo e utilizável.

## O que fazer, em ordem

Separado por esforço, porque a primeira faixa é configuração e pode ir hoje.

**Só configuração, sem código:**

| Mudança | Efeito |
|---|---|
| `VITE_PRESIGNED_UPLOAD_ENABLED=true` (conferir no VPS) | tira o tráfego de arquivo da API |
| `ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=8` | ~4x a vazão da análise |
| `ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT=2` | um cliente com lote não monopoliza |
| `TENANT_QUOTA_ENABLED=true` | teto por conta |

Nesta faixa, os 3000 documentos do cenário caem de ~55 para ~14 minutos.

**Código, por ordem de impacto:**

1. Limitador de vazão da Groq no Redis (achado 2) — **precisa vir junto** com a concorrência maior
2. Fatiamento sai do request e vai para a fila (achado 3)
3. Envio sobreposto no navegador, 2–3 em voo (achado 9)
4. Recuo progressivo com dispersão na consulta de status (achado 6)
5. Posição na fila e estimativa na tela (achado 10)
6. Reserva de slot com validade curta (achado 7)
7. Rate limit por usuário nas rotas caras (achado 5)

## O que já está certo

Vale registrar, para não ser mexido sem motivo:

- A análise já é assíncrona por fila, com o request devolvendo `202` e um `jobId`.
- Há concorrência por tenant, então um cliente com lote grande não come toda a fila.
- Rate limit da Groq é tratado por requisição, com `retry-after` respeitado, e o documento cai em
  estado próprio (`ai_paused`) em vez de erro genérico.
- Documento e análise são desacoplados: falha de preview, de trecho ou de vetor não impede o
  documento de ser salvo.
- O arquivo tem teto de tamanho em três camadas (nginx 30 MB, `MAX_UPLOAD_MB=25`, validação no
  cliente).
