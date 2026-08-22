# DOQYN — Plano de ação de escala (execução passo a passo)

**Versão:** 2.0
**Data:** 2026-07-20
**Escopo:** `doqyn-alpha-document-intelligence` + `doqyn-auth-service`
**Base:** auditoria de código de 2026-07-20 (leitura direta, com arquivo e linha)
**Meta:** sustentar ~4.000 tenants empresariais

### Hardware de produção (confirmado)

| Recurso | Valor | Consequência |
|---------|-------|--------------|
| Provedor | **Hostinger VPS — KVM 2** (host AMD EPYC 9354P) | upgrade planejado; ver escada na seção de dimensionamento |
| CPU | **2 vCPU** | é a restrição mais dura do sistema |
| RAM | **8 GB** | fecha, mas com pouca folga |
| GPU | nenhuma, e não é necessária | toda inferência é remota (Groq / Google Vision) |
| SO | Ubuntu 24.04 | — |
| MongoDB | **Atlas**, fora do VPS | libera ~3,5 GB de RAM; move o C1 para custo de tier |
| No VPS | postgres-auth, pgbouncer, auth-api, redis, doqyn-api, doqyn-worker, doqyn-worker-preview, nginx | 8 containers, 3 processos Node |

> **Relação com `docs/ARCHITECTURE_SCALE.md`:** aquele documento (v1.0, 2026-07-11) define a
> **estratégia**. Este define a **execução**, na ordem em que deve acontecer, dimensionada para o
> hardware acima. Onde os dois divergem, a divergência está no **Passo 0** — não resolva por
> conta própria.

---

## Leia isto antes de qualquer coisa

O hardware muda as conclusões da auditoria em três pontos, e ignorar isso desperdiça esforço:

**1. 2 vCPU inverte a prioridade.** A configuração atual pede **14 jobs pesados simultâneos**
(`ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=10` + `PREVIEW_QUEUE_CONCURRENCY_GLOBAL=4`, defaults em
`server/queues/analysisQueue.ts:33` e `previewQueue.ts:33`) para **2 núcleos**. São 4 processos
Ghostscript concorrentes disputando meia máquina cada. Isso não é um problema de 4.000 tenants —
é um problema de **hoje**, com qualquer carga real. Passou a ser o Passo 1.

**2. Réplicas da API deixam de fazer sentido.** O `docker-compose.production.yml` já contempla
`DOQYN_API_REPLICAS`, mas com 2 vCPU e 3 processos Node já competindo, cada réplica adiciona
~150 MB de RAM e troca de contexto sem entregar throughput. O passo de réplicas foi **removido**
deste plano e substituído por um gate de capacidade honesto (Passo 8).

**3. O Mongo estar no Atlas é boa notícia para a RAM e má notícia para o C1.** O limite de
namespaces do Atlas pode ser uma **parede rígida** muito antes da degradação que a auditoria
projetou. Ver Passo 0.

---

## Como usar este documento

Um passo por vez. Cada passo tem **Objetivo**, **Arquivos**, **Mudança**, **Validação**,
**Pronto quando** e **Commit**.

**Regra:** não inicie o passo seguinte sem a validação do anterior passando. Se um passo falhar
duas vezes, pare e reavalie — não empilhe correção sobre correção.

- [x] **Passo 1** — Concorrência e limites de recurso *(aplicado 2026-07-20, não deployado)*
- [x] **Passo 2** — Redis: `maxmemory` e `noeviction` *(aplicado 2026-07-20, não deployado)*
- [x] **Passo 1b** — Dois bugs bloqueantes no Compose, achados na validação *(ver abaixo)*
- [x] **Passo 0** — Decisão de arquitetura de coleções *(Opção A, decidida 2026-08-10)*
- [x] **Passo 3** — Índice `companyId` *(commitado em master `4a76fe4`; falta rodar contra o Atlas)*
- [x] **Passo 4** — Cache do documento de tenant *(aplicado 2026-08-10; falta medir contra o Atlas)*
- [x] **Passo 5** — Dashboard: eliminar as varreduras *(aplicado 2026-08-10; falta medir com tenant grande)*
- [x] **Passo 6** — Upload: teto de bytes e ordem de quota *(aplicado 2026-08-10; falta medir sob carga)*
- [x] **Passo 7** — Modelo de coleções *(aplicado 2026-08-10, corte seco sem migração)*
- [ ] **Passo 8** — Gate de capacidade: sair de 8GB/2vCPU
- [ ] **Passo 9** — Upload e download diretos no R2
- [ ] **Passo 10** — Sessão: TTL longo com invalidação por evento
- [ ] **Passo 11** — Retenção de auditoria e quota fail-closed
- [ ] **Passo 12** — Preview sob demanda *(maior corte de custo isolado)*

O Passo 0 aparece em terceiro porque é uma **decisão**, não código — pode acontecer em paralelo
aos Passos 1-2, mas precisa estar fechada antes do Passo 7.

---

## Achados que originam este plano

| ID | Severidade | Achado | Passo |
|----|-----------|--------|-------|
| **H0** | **Crítico** | 14 jobs concorrentes configurados para 2 vCPU | **1** |
| **H1** | **Crítico** | Redis sem `maxmemory` e sem política — BullMQ exige `noeviction` | **2** |
| C1 | Crítico | 10 coleções + 43 índices por tenant → 53 namespaces/tenant no Atlas | 0, 7 |
| C2 | Crítico | Dashboard faz 2 varreduras completas + 1 regex sem índice por load | 5 |
| C3 | Crítico | Parser multipart artesanal bloqueia o event loop, sem teto de memória | 6, 9 |
| A4 | Alto | Registry de tenants: 2 consultas por request, sem cache, `companyId` sem índice | 3, 4 |
| A5 | Alto | Nenhum limite de CPU/memória declarado nos 14 serviços do Compose | 1 |
| A6 | Alto | TTL de sessão em 45s → ~440 verify/s a 4.000 tenants | 10 |
| M7 | Médio | `auditLogs` cresce sem retenção, com 8 índices | 11 |
| M8 | Médio | Quota falha aberta quando o Redis cai | 11 |
| M9 | Médio | Download carrega o arquivo inteiro na RAM da API | 9 |

---

## Passo 1 — Concorrência e limites de recurso

**Este é o passo mais urgente do plano.** Não trata de 4.000 tenants: trata de o VPS não cair hoje.

**Objetivo:** parar de pedir 14 núcleos a uma máquina de 2, e trocar OOM-killer aleatório por
degradação controlada.

**Arquivos:** `deploy/.env` (produção), `deploy/docker-compose.production.yml`

### 1a. Concorrência dimensionada a 2 vCPU

Defaults atuais (`server/queues/analysisQueue.ts:33,37`, `server/queues/previewQueue.ts:33`):

| Variável | Default hoje | Alvo em 2 vCPU | Regra de derivação |
|----------|-------------|----------------|--------------------|
| `ANALYSIS_QUEUE_CONCURRENCY_GLOBAL` | 10 | **2** | `≈ vCPU` — análise espera muito em Groq/Vision, então pode igualar os núcleos |
| `ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT` | 2 | **1** | `≈ max(1, global / 2)` — nenhum tenant leva mais que metade da fila |
| `PREVIEW_QUEUE_CONCURRENCY_GLOBAL` | 4 | **1** | `≈ vCPU / 2` — cada job é um Ghostscript CPU-bound, sem espera de I/O |

Os valores estão parametrizados no Compose (`${ANALYSIS_QUEUE_CONCURRENCY_GLOBAL:-2}` etc.), então
**trocar de VPS é trocar três linhas do `deploy/.env`** — use as regras de derivação acima, não
os números fixos. Ver a seção *Dimensionamento e crescimento de hardware*.

Fila mais lenta é aceitável — o trabalho é assíncrono e o usuário já vê o documento como
"processando". Máquina travada não é aceitável.

### 1b. Limites por container

Nenhum dos serviços declara `cpus` ou `memory`. Orçamento proposto para 8 GB com Atlas fora do VPS:

| Serviço | `memory` | `cpus` | Heap Node |
|---------|---------|--------|-----------|
| postgres-auth | 1.0g | 0.5 | — (`shared_buffers=256MB`) |
| pgbouncer | 64m | 0.1 | — |
| redis | 900m | 0.3 | — (`maxmemory` no Passo 2) |
| auth-api | 512m | 0.5 | `--max-old-space-size=384` |
| doqyn-api | 1.0g | 0.8 | `--max-old-space-size=768` |
| doqyn-worker | 1.0g | 0.8 | `--max-old-space-size=768` |
| doqyn-worker-preview | 768m | 0.6 | `--max-old-space-size=512` |
| nginx | 128m | 0.2 | — |
| **Total** | **~5,3 GB** | — | sobra ~1,7 GB para SO e picos |

Dois pontos que costumam ser esquecidos:

- **`--max-old-space-size` é obrigatório**, não opcional. Sem ele o V8 dimensiona o heap pela RAM
  da máquina inteira (8 GB), ignora o limite do container e o cgroup mata o processo. Sempre abaixo
  do limite do container, porque o heap não é toda a memória do processo.
- **O profile `observability` não cabe.** Prometheus + Grafana consomem 600 MB–1 GB. Nesse
  hardware, use Grafana Cloud (free tier) recebendo remote-write, ou mantenha o profile desligado.
  Não rode observabilidade local competindo com o produto que ela deveria observar.

### 1c. Swap como rede de proteção

8 GB sem swap significa que qualquer estouro vira OOM-kill imediato. Um swapfile de 4 GB com
`vm.swappiness=10` transforma morte súbita em lentidão recuperável:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.d/99-doqyn.conf
```

**Validação:**

```bash
docker compose -f deploy/docker-compose.production.yml config    # limites presentes
docker stats --no-stream                                          # uso dentro do teto
uptime                                                            # load average < 2.0 em regime
```

Subir 20 documentos de uma vez e acompanhar `docker stats` + `uptime` durante o processamento.

**Pronto quando:** com a fila cheia, o load average fica abaixo de ~2,0, nenhum container é morto
por OOM e a API responde em latência normal enquanto os workers trabalham.

**Commit:** `ops(deploy): size queue concurrency and container limits for 2 vCPU / 8GB`

---

## Passo 2 — Redis: `maxmemory` e `noeviction`

**Objetivo:** impedir perda silenciosa de jobs e OOM por fork do Redis.

**Arquivos:** `deploy/docker-compose.production.yml` (serviço `redis`, linha 126)

**Mudança:** hoje o comando é `redis-server --save 60 1 --loglevel warning`. Três problemas:

1. **Sem `maxmemory`** — o Redis cresce até a máquina acabar. Ele guarda sessões, quotas, slots de
   concorrência e **todos os jobs do BullMQ**.
2. **Sem `maxmemory-policy`** — e aqui mora a armadilha. O instinto ao definir `maxmemory` é usar
   `allkeys-lru`. **Não faça.** O BullMQ exige `noeviction`: com LRU, o Redis descarta chaves de job
   sob pressão e documentos enviados simplesmente nunca são analisados, sem erro em lugar nenhum.
   É perda de dados silenciosa.
3. **`--save 60 1` faz fork para BGSAVE** — copy-on-write pode dobrar a memória do Redis por alguns
   segundos. Numa máquina apertada, é gatilho de OOM.

Configuração alvo:

```yaml
command:
  - redis-server
  - --maxmemory
  - 640mb
  - --maxmemory-policy
  - noeviction
  - --appendonly
  - "yes"
  - --appendfsync
  - everysec
  - --save
  - ""
  - --loglevel
  - warning
```

`noeviction` é seguro aqui porque **todas as chaves de cache já têm TTL**: sessão
(`sessionCache.ts:22`), quota (`tenantQuotas.ts:64`) e slot de análise
(`analysisTenantConcurrency.ts:17`, `expire` de 7200s). Nada cresce sem prazo. AOF com
`everysec` substitui o RDB sem o fork.

Uma consequência a tratar: com `noeviction`, escrita no Redis cheio retorna erro. O caminho de
cache de sessão precisa tratar falha de escrita como "não cacheou" e seguir, nunca como erro de
request.

**Validação:**

```bash
docker exec <redis> redis-cli config get maxmemory-policy   # noeviction
docker exec <redis> redis-cli info memory | grep used_memory_human
docker exec <redis> redis-cli info persistence | grep aof_enabled
```

Encher a fila com 200 jobs, confirmar que todos completam e que `used_memory` estabiliza abaixo do
teto.

**Pronto quando:** `maxmemory-policy` é `noeviction`, nenhum job é perdido sob carga e não há mais
fork de BGSAVE nos logs.

**Commit:** `ops(redis): cap memory with noeviction policy and switch rdb to aof`

---

## Passo 1b — Dois bugs bloqueantes encontrados na validação

Ao rodar `docker compose config` para validar o Passo 1, o arquivo **não parseava**. Os dois
problemas são anteriores a este plano e **impedem qualquer deploy** — nenhum é consequência das
mudanças acima.

### Bug 1 — YAML inválido desde o commit `9f6a4f3`

```yaml
REDIS_KEY_PREFIX: doqyn:auth:     # escalar terminando em ':' → YAML inválido
```

Em 4 serviços. O parser do Docker (go-yaml) recusa o projeto inteiro:
`mapping values are not allowed in this context`. Introduzido em
`9f6a4f3 chore: higiene P2 — Redis prefix`. **Corrigido** com aspas.

> Consequência: o `docker-compose.production.yml` em `master` não sobe. Se o VPS está no ar, ele
> roda uma versão anterior a esse commit.

### Bug 2 — `depends_on: mongo` quebra o deploy com Atlas

O serviço `mongo` é gated pelo profile `local-mongo`. Com `MONGODB_USE_ATLAS=true`,
`deploy/scripts/lib/compose-production.sh` **não** ativa o profile — e 4 serviços
(`doqyn-api`, `doqyn-api-indexes`, `doqyn-worker`, `doqyn-worker-preview`) declaravam
`depends_on: mongo`. Resultado: `depends on undefined service "mongo": invalid compose project`.

**Corrigido** removendo o `depends_on` em `mongo`. A prontidão continua coberta pelo healthcheck
profundo do `doqyn-api` (`/api/health/deep`, `start_period: 90s`) e pela ordem explícita em
`deploy-production.sh`.

### Validação executada

```
ATLAS (sem profile local-mongo):        OK
LOCAL-MONGO + OBSERVABILITY:            OK
```

Orçamento renderizado a partir do compose real:

| | mem_limit | cpus |
|---|---|---|
| postgres-auth | 1024M | 0.5 |
| pgbouncer | 64M | 0.1 |
| redis | 900M | 0.3 |
| auth-api | 512M | 0.5 |
| doqyn-api | 1024M | 0.8 |
| doqyn-worker | 1024M | 0.8 |
| doqyn-worker-preview | 768M | 0.6 |
| nginx | 128M | 0.2 |
| **Total** | **5,32 GB** | **3,8** |

Sobram **2,68 GB** para SO, page cache e picos. A soma de `cpus` passar de 2 é intencional: são
**tetos por container, não reservas** — nenhum serviço monopoliza, mas capacidade ociosa é
compartilhada.

**Falta fazer (não é código):** o swapfile do Passo 1c e o deploy propriamente dito. As mudanças
estão no repositório, **não em produção**.

---

## Passo 0 — Decisão de arquitetura: modelo de coleções

**Sem código. É uma decisão, e ela bloqueia o Passo 7.** Pode correr em paralelo aos Passos 1-2.

### O conflito

`docs/ARCHITECTURE_SCALE.md` (linha 722) registra:

| Prática | Status atual | Ação |
|---------|--------------|------|
| Collections prefixadas (business) | `tenantResolver.ts` | **manter** |

A auditoria chega a conclusão diferente. Contagem direta de `server/db/tenantIndexes.ts:65-173` e
`server/tenancy/tenantResolver.ts:53`: **10 coleções + 43 índices = 53 namespaces por tenant
empresarial**.

| Tenants | Coleções | Índices | Namespaces |
|---------|----------|---------|-----------|
| 100 | 1.000 | 4.300 | 5.300 |
| 500 | 5.000 | 21.500 | 26.500 |
| 1.000 | 10.000 | 43.000 | 53.000 |
| **4.000** | **40.000** | **172.000** | **212.000** |

### O que muda por estar no Atlas

Com Mongo gerenciado, isto deixa de ser pressão de RAM no VPS e vira **duas coisas piores**:

- **Possível parede rígida.** O Atlas impõe limite de namespaces por tier. Tiers menores
  documentam um teto na casa de **10.000 namespaces** — o que, a 53 por tenant, daria por volta de
  **190 tenants**. Se esse for o seu tier, o problema não é distante: está logo ali.
- **Custo direto.** Subir de tier para acomodar namespaces é gasto mensal permanente, não
  investimento único.

> **Ação imediata, antes de escolher a opção:** confirme o tier atual e o limite de namespaces dele
> no painel do Atlas, e conte os namespaces já em uso:
> ```js
> db.adminCommand({ listDatabases: 1, nameOnly: true })
> db.getCollectionNames().length
> db.getCollectionNames().reduce((n, c) => n + db[c].getIndexes().length, 0)
> ```
> Esse número dividido por 53 é quantos tenants você ainda comporta. **Registre-o aqui:**
> `namespaces em uso: ______ / limite do tier: ______ / tenants restantes: ______`

### Medição de 2026-07-21 — banco `doqyn_dev` (NÃO é produção)

O `.env` local aponta para `doqyn_dev`. Os números abaixo **não são do Atlas de produção** — falta
rodar a mesma medição contra ele. Mas a *estrutura* é a mesma, e ela confirma a contagem da
auditoria com dado real em vez de leitura de código:

| | Valor |
|---|---|
| Coleções | **58** (de 500 no M0) |
| Índices | **259** |
| Namespaces | **317** |
| Tenants empresariais com coleções dedicadas | **4** |
| **Coleções por tenant** | **10** ✅ bate com a auditoria |
| **Índices por tenant** | **43** ✅ bate com a auditoria |
| **Namespaces por tenant** | **53** ✅ bate com a auditoria |
| dataSize | 0,1 MB (dev vazio — não diz nada sobre produção) |

Com 10 coleções por tenant e 8 coleções compartilhadas fixas, o teto de 500 coleções do M0 dá
**~49 tenants**. O "teto de ~50 tenants" da seção de custo está confirmado, não estimado.

**Falta:** rodar contra o Atlas de produção para saber quantos tenants reais já existem e qual o
`dataSize` de verdade — é o `dataSize` que decide se o M0 morre por contagem ou por armazenamento.

### As opções

**Opção A — Coleções compartilhadas (recomendada).**
`documents`, `document_versions` etc. compartilhadas, com `tenantId` como primeiro campo de todo
índice composto. Prefixo dedicado sobrevive como plano enterprise para poucos clientes que exijam
separação física.
*Custo:* migração de dados + reescrita de `resolveTenantCollectionNames`.
*Ganho:* remove o teto de vez e derruba o custo de tier no Atlas.
*Nota:* os índices hoje lideram por `tenantId` **dentro de uma coleção onde `tenantId` é
constante** — prefixo de cardinalidade 1, desperdiçado. No modelo compartilhado o mesmo índice
passa a trabalhar, então são reaproveitáveis quase sem alteração.

**Opção B — Manter prefixo e subir de tier.**
*Custo:* mensalidade crescente; o teto se move, não desaparece.
*Ganho:* nenhuma migração agora.

**Opção C — Híbrido por porte.**
Pequenos e médios no pool compartilhado; grandes em coleções dedicadas, com promoção sob demanda.
*Custo:* dois caminhos de código.
*Ganho:* isolamento físico segue vendável como diferencial enterprise.

**Pronto quando:** a contagem de namespaces acima estiver preenchida, a opção estiver registrada
abaixo e `docs/ARCHITECTURE_SCALE.md` linha 722 atualizada.

```
Decisão: Opção A — coleções compartilhadas, isolamento por tenantId no documento
Data: 2026-08-10
Responsável: Sidnei Alves de Almeida
Justificativa: o teto medido é ~49 tenants no M0 (500 coleções ÷ 10 por tenant + 8 fixas),
               não 4.000. A meta do primeiro ano bate na parede muito antes do previsto,
               e subir de tier só move o teto — não o remove.
```

**Sem migração.** O MongoDB de produção ainda não existe: o ambiente é de desenvolvimento e o banco
será zerado. Isso descarta os 4 passos com flag e leitura dupla que esta seção descrevia — eles
existiam para migrar dado vivo, e não há dado vivo. Virou corte seco: o código passou a usar as
coleções compartilhadas, os caminhos legados foram **apagados** em vez de preservados atrás de
flag, e não há script de migração.

---

## Passo 3 — Índice em `companyId`

**Objetivo:** parar de varrer o registry de tenants em toda requisição.

**Arquivos:** `server/db/tenantIndexes.ts` (`ensureRegistryTenantIndexes`, linha 277)

**Mudança:** `server/tenancy/tenantResolver.ts:136` faz
`findOne({ $or: [{ tenantId }, { companyId }] })`. O `$or` só usa índice se **ambos** os ramos
forem indexados. Hoje há índice para `tenantId`, `taxIdHash`, `slug` e `status` — `companyId` não
está lá. Adicionar:

```ts
{ key: { companyId: 1 }, partialFilterExpression: { companyId: { $exists: true } } },
```

Parcial porque nem todo tenant tem `companyId`.

**Validação:**

```bash
npm run db:ensure-indexes
```

```js
db.tenants.find({ $or: [{ tenantId: "<id>" }, { companyId: "<id>" }] }).explain("executionStats")
// esperado: IXSCAN (ou OR sobre dois IXSCAN), não COLLSCAN
```

**Pronto quando:** o `explain` não mostra `COLLSCAN`.

**Commit:** `perf(db): index companyId on tenant registry to avoid per-request collscan`

### Correção do plano (2026-07-21, na execução)

O passo era "uma linha" em `tenantIndexes.ts`, mas isso **não teria efeito em produção**.
`scripts/ensure-mongodb-indexes.ts` (linhas 60-92) mantém uma **segunda lista** de índices do
registry, hardcoded e independente de `server/db/tenantIndexes.ts` — e é esse script que roda no
deploy, no serviço `doqyn-api-indexes`. Mexer só em `tenantIndexes.ts` faria o índice nascer apenas
no provisionamento do *próximo* tenant (`tenantProvisionService.ts:118`).

As duas listas já haviam divergido: a do script declarava `taxIdHash` como `unique` **sem**
`partialFilterExpression`. Num banco onde o script rodasse antes do provisionamento, o segundo
tenant sem `taxIdHash` quebraria com duplicate-key (Mongo trata campo ausente como `null`, e índice
único aceita um só `null`). Alinhado na mesma mudança.

**Dívida deixada:** a duplicação das duas listas continua, e é a causa raiz da divergência. O
script deveria consumir `ensureRegistryTenantIndexes()` em vez de reimplementá-la. Não feito agora
para não misturar refatoração com o passo.

---

## Passo 4 — Cache do documento de tenant

**Objetivo:** eliminar as duas idas ao Atlas por request no caminho quente. Com o banco fora do
VPS, cada consulta agora paga latência de rede — o ganho é maior do que seria com Mongo local.

**Arquivos:** `server/tenancy/tenantResolver.ts` (`resolveTenant`, linha 134),
`server/tenancy/tenantQuotas.ts` (`loadTenantQuotaOverrides`, linha 40)

**Mudança:** `getTenantCollections()` roda em praticamente toda requisição e sempre vai ao banco;
no upload há uma segunda consulta ao mesmo registry para ler quotas. Cachear o documento de tenant
em Redis com TTL curto (60–120s) e servir as duas leituras do mesmo cache.

- Chavear por `tenantId` **e** por `companyId` — os dois resolvem o mesmo documento.
- Invalidar explicitamente em `tenantProvisionService.ts` e em qualquer update de tenant/quota;
  TTL sozinho não basta para mudança de quota, que precisa valer na hora.
- Sem Redis, cair para consulta direta (comportamento de hoje).
- Atenção ao Passo 2: com `noeviction`, falha de escrita no cache não pode derrubar o request.

**Validação:** medir consultas ao registry num fluxo de 20 requisições autenticadas. Antes:
~20–40. Depois: 1–2. Use o profiler do Atlas ou:

```js
db.setProfilingLevel(2, { slowms: 0 })
db.system.profile.find({ ns: /tenants$/ }).count()
db.setProfilingLevel(0)
```

**Pronto quando:** a contagem cai pelo menos uma ordem de grandeza e alterar a quota de um tenant
vale na requisição seguinte.

**Commit:** `perf(tenancy): cache tenant registry doc in redis with explicit invalidation`

### Execução (2026-08-10)

Implementado em `server/tenancy/tenantRegistryCache.ts`, ligado em `resolveTenant()` e consumido
por `loadTenantQuotaOverrides()` — que **deixou de consultar o registry direto** e passa por
`resolveTenant`, então a segunda ida ao Atlas no upload some junto. TTL padrão 90s,
`TENANT_REGISTRY_CACHE_ENABLED` / `TENANT_REGISTRY_CACHE_TTL_SECONDS` no `.env.example`.

Três detalhes que não estavam no plano e apareceram na execução:

- **`Date` não sobrevive ao JSON.** O round-trip por `redisSetJson` devolveria `createdAt`,
  `updatedAt`, `storage.bucketCreatedAt` e `storage.bucketLastCheckedAt` como string, e o documento
  cacheado deixaria de ser intercambiável com o do driver. `reviveTenant()` reidrata esses campos.
- **Cache de projeção envenenaria o cache.** `loadTenantQuotaOverrides` lia com
  `projection: { quotas: 1 }`; cachear esse documento parcial sob a mesma chave quebraria
  `getTenantCollections`. Por isso a leitura passou a ser o documento inteiro via `resolveTenant`,
  com `TENANT_NOT_FOUND` traduzido de volta para "sem overrides".
- **`redisDel` não existia** em `server/redis/redisClient.ts`. Adicionado no mesmo formato dos
  outros helpers: sem cliente ou com erro, engole e segue — invalidação nunca derruba o write.

Invalidação explícita em todos os writers do registry: `tenantProvisionService`,
`tenantStorageConfigService` (3 pontos), `trashRetentionSettings`, `tenantsService` (seed de dev).
Não há hoje nenhum writer de `quotas` — elas vêm só de env; o gancho já está pronto para quando
houver.

**Falta:** a medição de validação (contagem de consultas ao registry) contra o Atlas — o ambiente
local não tem Redis nem o banco de produção. Sem ela o passo está aplicado, não comprovado.

#### Correções da revisão de código (2026-08-10)

Dois defeitos de coerência do cache, achados na revisão do próprio diff:

- **Invalidação alcançava só metade das chaves.** O documento é gravado sob `tenantId` **e**
  `companyId`, mas `tenantStorageConfigService` e `trashRetentionSettings` só conhecem o id que
  receberam. Para tenant onde os dois diferem, `markTenantBucketReady(tenantId)` deixava
  `tenant:registry:<companyId>` servindo `bucketStatus: 'pending'` pelo TTL inteiro. Resolvido
  dentro do módulo: a invalidação lê o documento cacheado, descobre o alias irmão e apaga os dois —
  todos os chamadores ficam corretos sem precisar saber disso.
- **Corrida entre leitura e gravação.** Se um writer invalidava entre o `findOne` e o
  `setCachedTenant` de um request já em voo, o retrato velho voltava e sobrevivia 90s — o oposto do
  contrato do passo. Fechado com marca de invalidação de vida curta (15s) que o `setCachedTenant`
  consulta antes de gravar.

Também: `reviveTenant` coagia data ausente para epoch, o que faria um tenant legado sem `createdAt`
aparecer como 01/01/1970 no caminho cacheado e vazio no direto. Agora campo ausente continua
ausente.

---

## Passo 5 — Dashboard: eliminar as varreduras

**Objetivo:** tirar o custo de varredura completa do caminho de login. Com Atlas, cada documento
varrido também atravessa a rede — o desperdício é maior do que a auditoria original estimou.

**Arquivos:** `server/services/dashboardOverviewService.ts` (linhas 296-334)

**Mudança:** três problemas no mesmo `Promise.all`.

1. **Linha 306** — `documents.find(docQuery).project({ processingStatus: 1 }).toArray()` sem
   `limit`: traz todos os documentos do tenant para a memória do Node só para contar status.
2. **Linhas 307-310** — segunda varredura completa, para agrupar por classe.
3. **Linhas 330-334** — `{ action: { $regex: '^document\\.', $options: 'i' } }`: o `$options: 'i'`
   anula o índice mesmo com regex ancorado, varrendo `auditLogs` inteira.

Correções:

- Substituir (1) e (2) por um único `aggregate` com `$facet`, agrupando no servidor: volta uma
  dúzia de linhas em vez de N documentos.
- Em (3), remover `$options: 'i'` e normalizar `action` para minúsculas **na escrita**
  (`emitTrackingEvent`), para usar `{ tenantId: 1, action: 1, createdAt: -1 }`. Havendo histórico
  com caixa mista, rodar `updateMany` de normalização antes.
- Para o total geral (linha 297), avaliar `estimatedDocumentCount()`.

**Validação:** com tenant de teste populado (ideal: 50k+ documentos), medir latência do endpoint
antes e depois e confirmar `IXSCAN` na consulta de auditoria.

**Pronto quando:** o volume trafegado do Atlas para o Node por load do dashboard é constante — não
cresce com o tamanho do tenant.

**Commit:** `perf(dashboard): replace full collection scans with $facet aggregation`

### Execução (2026-08-10)

`aggregateDocumentFacets()` em `dashboardOverviewService.ts` reduz **cinco consultas a uma**. O
plano previa juntar só as duas varreduras; os três `countDocuments` (total, hoje, período) entraram
no mesmo `$facet` porque o `$match` já precisa percorrer o conjunto acessível para agrupar — os
ramos de data pegam carona sem custo extra e economizam duas idas ao Atlas.

Ramos: `total`, `today`, `inPeriod`, `byStatus`, `byCategory`, `withoutCategory`. O `$sort`+`$limit`
de categorias passou para o servidor (`CATEGORY_FACET_LIMIT = 8`), então o retorno é uma dúzia de
linhas independentemente do tamanho do tenant.

Dois detalhes de fidelidade:

- O código antigo fazia `.trim()` em `classId`/`className` no Node, então documento com o campo
  só de espaços contava como "sem categoria". Reproduzido com `$trim` num `$project` antes do
  `$facet` — sem isso a contagem de governança mudaria silenciosamente.
- `mapStatusBucket` continua em TypeScript, aplicado sobre as ~6 linhas agrupadas. Traduzir a regra
  para expressão de agregação duplicaria a lógica em dois lugares sem ganho.

**Regex de auditoria:** `$options: 'i'` removido da contagem do dashboard. Para isso ser seguro,
`createDocumentAuditLog` agora normaliza `action` para minúsculas **na escrita**. Todas as actions
já eram constantes minúsculas (verificado em `documentAuditTypes.ts` — zero chaves com maiúscula),
então **não é preciso o `updateMany` de normalização** que o plano previa. A normalização trava o
contrato para o futuro.

**Dívida deixada:** `auditService.ts`/`documentAuditLogService.ts` ainda têm ~7 outros filtros com
`$options: 'i'` sobre `action` (abas do audit center, filtros de tracking). Mesma causa, mesmo
efeito no índice — mas estão fora do Passo 5 e não entraram, para não misturar escopo.

**Falta:** medir latência antes/depois com tenant de 50k+ documentos e confirmar `IXSCAN` na
consulta de auditoria. Sem ambiente com dado real, o passo está aplicado, não comprovado.

---

## Passo 6 — Upload: teto de bytes e ordem de quota

**Objetivo:** impedir que um upload derrube a latência de todos os tenants. Mitigação — a solução
estrutural é o Passo 9.

**Arquivos:** `api/documents/upload.ts` (linhas 13-61, 68, 88)

**Mudança:** o parser multipart é artesanal e:

- acumula o corpo inteiro com `Buffer.concat(chunks)` (linha 28) **sem limite de tamanho**;
- converte tudo para string e faz `split` (linha 32) — operações síncronas O(n) que **bloqueiam o
  event loop**;
- roda na linha 72, **antes** de `assertTenantQuota()` na linha 88.

Com 2 vCPU isso é especialmente grave: metade da capacidade da máquina fica presa numa operação
síncrona enquanto o worker de preview disputa a outra metade.

Nesta ordem:

1. Mover `assertTenantQuota(ctx.tenantId, 'uploads_per_hour')` para **antes** do parse.
2. Rejeitar por `Content-Length` acima do teto antes de ler qualquer byte (`413`).
3. Trocar o parser artesanal por `busboy` em streaming, com `limits.fileSize`.

O item 3 é o que remove o bloqueio; 1 e 2 apenas limitam o dano.

**Validação:**

```bash
curl -X POST -F "file=@arquivo-grande.pdf" <endpoint> -i    # 413 sem consumir memória
```

Em paralelo, disparar upload grande e medir latência de um `GET /api/documents` concorrente.

**Pronto quando:** a latência de leitura de outro tenant não é afetada por um upload de 50 MB em
andamento, e arquivo acima do teto é rejeitado antes do buffer.

**Commit:** `fix(upload): stream multipart with size limit and enforce quota before parsing`

### Execução (2026-08-10)

Os três itens, na ordem do plano:

1. `assertTenantQuota(ctx.tenantId, 'uploads_per_hour')` subiu para **antes** do parse.
2. `declaredSizeExceedsLimit()` rejeita por `Content-Length` com `413` antes de ler byte. É defesa
   de conveniência, não de segurança — cliente pode mentir no cabeçalho ou usar
   `Transfer-Encoding: chunked`; quem garante o teto é o busboy.
3. Parser artesanal trocado por **busboy** em streaming, com `limits.fileSize`, `files: 1`,
   `fields: 32` e `fieldSize: 1 MB`.

**O parser era duplicado.** Havia duas cópias do mesmo código: uma local em `api/documents/upload.ts`
e outra em `server/utils/parseMultipart.ts`, esta consumida também por `api/profile/avatar.ts` e
`server/utils/parseAnalyzePdfRequest.ts`. Reescrevi o módulo compartilhado e apaguei a cópia local,
então os **três** caminhos de upload deixaram de bloquear o event loop — é o mesmo achado C3, não
escopo novo. O de avatar passou a usar o próprio teto (`PROFILE_AVATAR_MAX_SIZE_MB`, 5 MB) em vez do
teto de documentos, então imagem grande morre no stream.

O erro de tamanho virou `ServiceError('...', 'FILE_TOO_LARGE', 413)`, que os três handlers já
traduzem para HTTP pelo `catch` existente — nenhum precisou de tratamento novo.

Detalhe que custou atenção: ao abortar por limite é preciso `req.unpipe()` **e** `req.resume()`.
Sem drenar o resto do corpo, o socket fica pendurado até o timeout do cliente — o oposto do que o
passo quer.

`busboy@^1.6.0` entrou em `dependencies`, `@types/busboy` em `devDependencies`. Bundle de produção
(`npm run build:server`) resolve normalmente.

**Ainda em memória:** o arquivo continua sendo materializado em `Buffer` porque `uploadDocument`
recebe buffer. O que sumiu foi o `toString('binary')` + `split` síncronos e a ausência de teto.
Eliminar o buffer é o Passo 9.

**Falta:** medir latência de um `GET /api/documents` concorrente durante upload de 50 MB. Sem
ambiente, aplicado e testado em unidade, não comprovado sob carga.

#### Correções da revisão de código (2026-08-10)

A troca para busboy introduziu um vazamento pior do que o problema original, achado na revisão e
**reproduzido antes de corrigir**:

- **Cliente que abandona o upload pendurava a promise para sempre.** `req.pipe(bb)` não propaga
  erro nem fim prematuro da origem para o destino: com `req.destroy()` silencioso o busboy não
  emitia `close` nem `error`, e `parseMultipart` nunca assentava — o handler, o socket e o buffer já
  acumulado (até `maxUploadBytes`) ficavam presos na heap a **cada** upload interrompido. Com erro
  no destroy era pior: o `'error'` do `req` não tinha ouvinte e derrubava o processo. O parser
  antigo rejeitava com `ERR_STREAM_PREMATURE_CLOSE`, então isto era regressão. Corrigido com
  handlers de `error`, `aborted` e `close` prematuro; coberto por dois testes.
- **Drenagem do corpo recusado era ilimitada.** `req.resume()` após o 413 lia e descartava todo o
  resto — um corpo de 5 GB custava 5 GB de leitura mesmo já recusado, na máquina que o passo existe
  para proteger. Agora drena até 2 MB (o bastante para o cliente ler a resposta) e corta a conexão.
- **Campo de texto truncado virava erro 500.** O busboy trunca campo acima de `fieldSize` e emite
  `'field'` assim mesmo; o valor parcial ia para `JSON.parse(fields.accessGroups)` e estourava como
  `SyntaxError`, que não é `ServiceError` e virava 500 com a mensagem do parser. Agora vira
  `FIELD_TOO_LARGE` (413), e o `JSON.parse` ficou protegido por `INVALID_ACCESS_GROUPS` (400).

Dois ajustes de comportamento no handler:

- **`Content-Length` recusava arquivo no tamanho exato do limite.** O cabeçalho mede o corpo
  inteiro (boundary, cabeçalhos de parte, campos), o teto do busboy mede só os bytes do arquivo.
  Arquivo de exatamente 25 MB era recusado pelo envelope. Adicionada folga de 1 MB.
- **Quota era queimada por upload que nunca acontecia.** Mover `assertTenantQuota` para antes do
  parse — como o plano pedia — fez `INCR` acontecer também para arquivo grande demais, multipart
  malformado ou cliente que desiste: cinco tentativas de enviar um arquivo acima do teto gastavam
  cinco slots da hora sem um único write. Separado em `assertTenantQuotaAvailable()` (só verifica,
  antes do parse) e `assertTenantQuota()` (consome, depois do parse). O objetivo do plano — não
  gastar CPU com tenant já bloqueado — continua atendido.

---

> **Ponto de corte.** Os Passos 1-6 cabem em dias e resolvem o risco imediato. Antes de seguir,
> colete a baseline (tabela no fim). Sem ela, nenhum ganho dos próximos é demonstrável.

---

## Passo 7 — Modelo de coleções

**Concluído em 2026-08-10** com a Opção A do Passo 0.

**Objetivo:** remover o teto de namespaces do Atlas.

**Arquivos principais:** `server/tenancy/tenantResolver.ts`,
`server/tenancy/getTenantCollections.ts`, `server/db/tenantIndexes.ts`,
`server/services/tenantProvisionService.ts` (linhas 196, 205)

### Execução (2026-08-10) — corte seco, Opção A

**O resultado que importa:** provisionar tenant novo **não cria mais nenhum namespace**. Antes eram
10 coleções + 43 índices = 53 por tenant. Agora são 10 coleções fixas, garantidas uma vez, para
qualquer número de tenants. O teto de ~49 tenants do M0 deixou de existir.

Um teste trava isso: mil tenants resolvidos em sequência produzem exatamente 10 nomes de coleção
(`tests/shared-collection-model.test.ts`).

**O que já estava pronto e barateou o passo.** `applyDocumentOwnershipOnInsert` sempre gravou
`tenantId`, `companyId`, `tenantType`, `ownerTenantId` e `ownerUserId` em todo documento — nenhum
backfill foi necessário. E o caminho de pessoa física já era um pool compartilhado filtrado por
ownership, ou seja, a Opção A já rodava para metade dos tenants. Como a auditoria previu, os índices
já lideravam por `tenantId`; dentro de uma coleção dedicada esse prefixo tinha cardinalidade 1 e era
desperdiçado — agora ele trabalha, sem nenhuma alteração nos índices.

**O buraco de isolamento, que era o risco real.** `buildDedicatedBusinessOwnershipFilter` tinha um
ramo casando documentos **sem** `tenantId` nem `companyId`, e `assertCanAccessDocument` fazia
`if (tenantId && tenantId !== context.tenantId)` — deixando passar documento sem dono. Inofensivo
enquanto a coleção pertencia a um único tenant; em pool compartilhado seria vazamento de todo
documento órfão para **todos** os tenants. Os dois ramos foram removidos: a comparação virou
igualdade estrita e documento sem `tenantId` não é visível para ninguém. É o único ponto do passo
que teria virado incidente de segurança se passasse batido.

**Redução extra não prevista no plano.** O segundo conjunto de índices, liderado por
`ownerTenantId` (`sharedIndividualIndexSpecs`), foi apagado. Com PF e PJ na mesma coleção e
`ownerTenantId` recebendo o mesmo valor de `tenantId` na gravação, ele seria duplicata exata —
dobraria os namespaces, justo o custo que o passo corta. O filtro de PF passou a liderar por
`tenantId` (mantendo `ownerUserId`, que é isolamento mais estreito) e reaproveita os índices
existentes. Só faltava `{ tenantId, ownerUserId, createdAt }` em `audit_logs`, adicionado.

**Consolidação.** `resolveTenantCollectionNames(tenant)` ficou idêntica a `resolveSharedCollections()`
— dois nomes para a mesma coisa. Unificadas numa só, com os 14 chamadores atualizados.
`listTenantCollectionNames` ficou sem uso e foi removida.

**Fora do núcleo, mas quebrado pelo passo:**

- `scripts/test-tenant-isolation.ts` foi **reescrito**. Ele comparava nomes de coleção
  (`documents_company_dev` vs `documents_company_test_2`) — checagem que virou vácuo, e pior:
  contar documentos de B na "coleção de A" agora acusaria vazamento falso, porque é a mesma
  coleção. Passou a exercitar o que de fato isola: consulta escopada por um tenant não devolve
  documento de outro, nem documento sem dono.
- `scripts/ensure-mongodb-indexes.ts` garantia índices num laço por tenant ativo. Com todos
  resolvendo para as mesmas coleções, isso refaria o mesmo trabalho N vezes — passou a rodar uma
  vez só.
- `assert-no-flat-tenant-writes` **continua valendo, e vale mais**: escrever direto em
  `db.collection('documents')` agora grava no pool compartilhado sem escopo de tenant. A checagem
  não mudou, só a justificativa.
- Seed de demo, backfill de `searchMeta` e auditoria de governança montavam nomes prefixados à mão.

**Verificação:** typecheck limpo (server e scripts, sem erro novo); ESLint no baseline (8 arquivos,
nenhum tocado por este passo); `build:server` OK; `audit:no-flat-writes` PASS; suíte com 248 testes
passando e as mesmas 42 falhas pré-existentes do baseline. 8 testes que codificavam o modelo antigo
foram reescritos para o novo, mais `tests/shared-collection-model.test.ts` com 7 casos novos.

**Falta:** rodar `npm run test:tenant-isolation` contra um banco de verdade, com dois tenants
semeados. Sem Mongo no ambiente, o passo está aplicado e coberto por teste de unidade, não
verificado contra dado real.

**Commit:** `refactor(tenancy): move tenant data to shared collections scoped by tenantId`

---

## Custo: manter a curva plana

> Restrição declarada: o custo de infraestrutura precisa ficar o mais plano possível em relação ao
> número de clientes. Esta seção existe porque **a decisão do Passo 0 é, antes de tudo, uma decisão
> de custo** — não uma preferência técnica.

### O limite do plano gratuito do Atlas

O tier M0 (gratuito) tem limites rígidos e documentados. Os que importam aqui:

| Limite M0 | Valor | O que ele significa neste app |
|-----------|-------|-------------------------------|
| Coleções por cluster | **500** | 10 coleções por tenant → **teto de ~50 tenants** |
| Armazenamento | **512 MB** | documentos + versões + chunks + auditoria de todos os tenants |
| Conexões | **500** | `MONGODB_MAX_POOL_SIZE=50` × 3 processos = **150 já em uso** |

> **Confirme antes de planejar em cima disto** — limites de tier mudam. Conte o que já existe:
> ```js
> db.getCollectionNames().length          // contra o teto de 500
> db.stats().dataSize / 1024 / 1024       // MB, contra o teto de 512
> ```

A parede não está em 4.000 tenants nem em 190. **Está em ~50.** E o teto de armazenamento pode
chegar antes, dependendo do volume de chunks e auditoria.

### Por que o modelo de coleções é uma decisão de custo

Esta é a forma de explicar a migração para quem aprova orçamento:

| Modelo | Custo de infra escala com | Consequência |
|--------|---------------------------|--------------|
| **Prefixo por tenant (hoje)** | **número de clientes** | cada cliente novo consome 53 namespaces. Você troca de tier por causa de *contagem*, não de uso. Um cliente que mal usa o produto custa o mesmo que um cliente pesado. |
| **Coleções compartilhadas** | **volume de dados** | ~12 coleções, constante para sempre. Você só sobe de tier quando há dado de verdade — ou seja, quando há receita. |

O modelo atual **cobra por crescer na única dimensão em que você quer crescer.** É o oposto de
uma curva plana. Migrar não é refinamento técnico: é o que separa um custo proporcional à receita
de um custo proporcional à lista de clientes.

### Quanto o M0 realmente aguenta

Antes da escada, um dado que muda a leitura: **os PDFs estão no R2, não no Mongo.** O banco guarda
apenas metadados, versões, chunks de RAG e auditoria. Os 512 MB rendem bem mais do que a intuição
sugere — mas não infinitamente.

Estimativa por documento (validar com dados reais antes de decidir):

| Item no Mongo | Tamanho aprox. |
|---------------|----------------|
| Metadados do documento | 2–5 KB |
| Chunks de RAG | ~20 KB (o item pesado) |
| Auditoria ao longo da vida | ~5 KB |
| **Total** | **~30 KB por documento** |

512 MB ÷ 30 KB ≈ **17.000 documentos no total do cluster**. Distribuído em 50 tenants, dá ~340
documentos por cliente.

**Conclusão honesta: o M0 é tier de piloto, não de produção.** Depois da migração para coleções
compartilhadas, ele deixa de bindar por contagem de coleções e passa a bindar por armazenamento —
provavelmente antes dos 50 tenants que o limite de 500 coleções sugeria.

Meça o seu número real em vez de confiar na estimativa:

```js
db.stats().dataSize / 1024 / 1024                    // MB em uso
db.stats().dataSize / db.documents.countDocuments()  // bytes por documento, real
```

### Escada de custo, na ordem correta

> **Correção da v2.0 deste documento:** a versão anterior sugeria que auto-hospedar o Mongo custaria
> "R$ 0 adicionais por usar o VPS que já existe". **Isso não fecha no KVM 2.** O orçamento de
> 5,32 GB do Passo 1 foi calculado assumindo o Mongo *fora* do VPS. Somando um Mongo utilizável
> (cache de 1 GB + overhead ≈ 1,5 GB) e o SO (~1 GB), chega-se a ~7,8 GB de 8 GB — margem zero, e
> o primeiro pico de Ghostscript aciona o OOM-killer. Self-host no hardware atual não é economia:
> é troca de mensalidade por indisponibilidade.

**Etapa 1 — Migração para coleções compartilhadas. Sempre primeiro.**
Vale nos dois mundos. Mongo auto-hospedado com 40.000 coleções é *igualmente* ruim: os mesmos file
handles do WiredTiger, a mesma pressão de cache, o mesmo tempo de startup. **Self-host não
substitui a migração — ela é pré-requisito de qualquer caminho.** Custo: **R$ 0**.

**Etapa 2 — Permanecer no M0 gratuito e medir.**
Com ~12 coleções fixas, o teto de 500 sai do caminho. Acompanhar `dataSize` contra os 512 MB e a
métrica real de bytes por documento. Custo: **R$ 0**. Esta etapa dura o quanto o volume permitir —
possivelmente todo o período de piloto.

**Etapa 3 — KVM 4 *e* Mongo auto-hospedado, juntos.**
Quando o armazenamento apertar. Os dois na mesma mudança, nunca um sem o outro. No KVM 4 (16 GB) a
conta fecha com folga:

| Serviço | `mem_limit` |
|---------|------------|
| mongo (`--wiredTigerCacheSizeGB=2`) | 4,0 GB |
| postgres-auth | 1,0 GB |
| redis | 0,9 GB |
| doqyn-api | 1,5 GB |
| doqyn-worker + doqyn-worker-preview | 1,8 GB |
| auth-api + pgbouncer + nginx | 0,7 GB |
| **Total** | **~10 GB de 16 GB** |

O Compose já suporta: `profiles: ["local-mongo"]` e `MONGODB_USE_ATLAS=false` — é mudança de
`.env`, não de código.

O que se assume junto com a economia:
- `--wiredTigerCacheSizeGB` explícito. Sem isso o Mongo toma metade da RAM da VM e mata o resto.
- `mongodump` noturno para o R2 (já pago, sem egress) — **e restaurado ao menos uma vez, para
  valer**. Backup nunca testado não é backup. `scripts/mongo-backup-before-cleanup.sh` é ponto de
  partida.
- Sem failover automático: queda do VPS é queda do banco. Definir de antemão quanto tempo de
  indisponibilidade é tolerável.

**Etapa 4 — Atlas pago, só se a confiabilidade exigir.**
Quando a indisponibilidade custar mais que a mensalidade. Não antes.

### Resumo da sequência

```
migração de coleções  →  medir M0  →  KVM 4 + self-host (juntos)  →  Atlas pago (talvez nunca)
      R$ 0                 R$ 0            custo do KVM 4              só se necessário
```

O erro a evitar é pular direto para a etapa 3 achando que economiza: sem a migração, o Mongo
auto-hospedado herda o mesmo problema estrutural, agora sem suporte de ninguém.

### Outros cortes de custo, por retorno

| Corte | Onde | Economia | Esforço |
|-------|------|----------|---------|
| **Preview sob demanda** | `confirmAnalysisService.ts:33` | **alta** — hoje todo upload gera preview via Ghostscript, mesmo os que ninguém abre. É o maior consumo de CPU do sistema, e CPU é o que define o tamanho do VPS. | médio |
| Retenção de auditoria | Passo 11 | alta — `auditLogs` é a coleção que mais cresce, e armazenamento é o que binda em todo tier | baixo |
| Tokens da Groq | `PDF_ANALYSIS_MAX_INPUT_CHARS=30000` | média — custo por documento analisado; reduzir onde a acurácia permitir | baixo |
| Pool de conexões | `MONGODB_MAX_POOL_SIZE=50` | baixa, mas necessária — 150 de 500 conexões do M0 já em uso | baixo |
| Adiar o segundo VPS | Passo 8 | direta — só comprar quando os gatilhos dispararem, nunca por precaução | nenhum |

**O maior deles é o preview sob demanda.** Hoje o preview é agendado no `confirmAnalysis` para
todo documento enviado. Numa base de gestão documental, a maioria dos documentos é arquivada e
nunca visualizada — então boa parte desse CPU é desperdício puro. Gerar na primeira visualização e
cachear no R2 corta o consumo de CPU proporcionalmente à fração de documentos nunca abertos, e
adia diretamente a compra do KVM 4 de workers.

Medir antes de mexer: que percentual dos documentos recebe ao menos uma visualização de preview
nos primeiros 30 dias? Se for abaixo de 50%, o ganho é grande e óbvio.

### Onde NÃO economizar

- **Backup**, se auto-hospedar o Mongo. Sem backup restaurado ao menos uma vez, a economia vira
  risco existencial — perder dados de cliente custa mais que qualquer mensalidade evitada.
- **RAM ao trazer o Mongo para dentro.** Self-host num VPS sem folga não é economia, é
  indisponibilidade agendada. Etapas 3 e "KVM 4" andam juntas.
- **Os limites de recurso do Passo 1.** Custam zero e evitam o OOM que derruba tudo.
- **A migração do Passo 7.** Adiá-la é o que torna o custo insustentável depois — exatamente o
  cenário que se quer evitar.

---

## Dimensionamento e crescimento de hardware

> Escrito porque a intenção declarada é migrar para um VPS mais forte. Esta seção existe para que
> essa compra seja feita com número, no momento certo, e sem expectativa errada sobre o que ela
> resolve.

### O que hardware compra e o que não compra

| Item | VPS mais forte resolve? | Por quê |
|------|------------------------|---------|
| H0 — 14 jobs em 2 vCPU | **Sim, parcialmente** | mais núcleos permitem concorrência maior; a regra de derivação continua valendo |
| A5 — sem limites de recurso | **Não** | limites são higiene em qualquer tamanho; só mudam os valores |
| C3 — event loop bloqueado no upload | **Não** | um core a mais não desbloqueia um loop travado; só dilui o sintoma |
| M9 — download na RAM da API | **Adia** | mais RAM aguenta mais downloads simultâneos, o custo por download não muda |
| A6 — 440 verify/s | **Adia** | é carga de rede e de Postgres, não de CPU do app |
| **C2 — varreduras do dashboard** | **Não** | o custo é no Atlas e na rede, não no VPS |
| **C1 — namespaces por tenant** | **Não** | é limite do Atlas; o VPS não participa |
| **M7 — auditoria sem retenção** | **Não** | é armazenamento no Atlas |

Metade dos itens críticos é **imune a hardware**. Um VPS mais forte é aceleração, não solução —
por isso ele aparece como Passo 8 e não como Passo 1.

### O número que decide todo o dimensionamento

A capacidade desta aplicação é governada por **um** valor que hoje ninguém mediu:
**quantos CPU-segundos custa gerar o preview de um documento típico seu.**

O Ghostscript é o único consumo de CPU puro e sustentado do sistema — a análise passa a maior
parte do tempo esperando Groq/Vision, e a API (depois do Passo 9) vira quase toda I/O.

Meça assim, com PDFs reais de clientes:

```bash
# dentro do container do worker de preview, num job representativo
/usr/bin/time -v gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH \
  -sOutputFile=/dev/null <documento-tipico.pdf> 2>&1 | grep -E "User time|System time"
```

Com esse número (`C`, em segundos de CPU por documento), o resto se calcula:

```
núcleos de worker = (documentos por dia × C × fator_de_pico) / 86400
```

`fator_de_pico ≈ 3` porque o trabalho se concentra no horário comercial, não nas 24h.

Cenários com `C = 4s` (chute inicial — **substitua pelo seu medido**):

| Tenants | Docs/dia por tenant | Docs/dia | Núcleos de worker no pico |
|---------|--------------------|----------|--------------------------|
| 500 | 10 | 5.000 | ~0,7 |
| 1.000 | 10 | 10.000 | ~1,4 |
| 4.000 | 10 | 40.000 | **~5,6** |
| 4.000 | 20 | 80.000 | **~11,1** |
| 4.000 | 50 | 200.000 | **~27,8** |

A leitura importante: **a geração de preview é o que define o tamanho da frota**, e ela cresce
linearmente com o volume de documentos — não com o número de tenants. Dois clientes grandes podem
custar mais CPU que mil pequenos.

### Alvo de hardware

Com todas as correções aplicadas, a divisão natural é **separar a frota de workers da máquina de
aplicação**, porque as duas escalam por motivos diferentes:

| Papel | Escala com | Alvo para 4.000 tenants |
|-------|-----------|------------------------|
| API + auth + nginx + Redis + Postgres | usuários simultâneos | 4 vCPU / 16 GB |
| Workers (análise + preview) | documentos por dia | dimensionar pela fórmula acima; começar com 4 vCPU / 8 GB |

Depois do Passo 9 (binário fora da API) e do Passo 5 (dashboard sem varredura), a API deixa de ser
CPU-bound e 4 vCPU cobrem folgadamente 4.000 tenants. O crescimento fica todo do lado dos workers,
que são stateless e podem ser adicionados sem tocar no resto.

### Escada concreta na Hostinger

Estamos hoje no **KVM 2** (2 vCPU / 8 GB) e o topo da linha é o **KVM 8** (8 vCPU / 32 GB).
As duas formas de chegar a 8 vCPU / 32 GB não são equivalentes:

| Opção | Composição | A favor | Contra |
|-------|-----------|---------|--------|
| **A — um KVM 8** | 8 vCPU / 32 GB numa máquina | mais simples de operar; nada muda no Compose além dos limites | tudo num único domínio de falha; workers voltam a competir com a API pelos mesmos núcleos |
| **B — dois KVM 4** | 4 vCPU / 16 GB para app + 4 vCPU / 16 GB para workers | isola o CPU-bound do caminho de request; um pico de preview não derruba a API; frota de worker cresce sozinha | dois hosts para manter; Redis passa a ser acessado pela rede |

**Recomendação: B.** O problema central deste sistema não é falta de núcleos — é *disputa* por
núcleos entre trabalho de usuário (latência importa) e trabalho de lote (latência não importa).
Um KVM 8 dobra os dois lados e mantém a disputa; dois KVM 4 eliminam a disputa. Se o orçamento
só permitir um passo agora, o **KVM 4 dedicado a workers** entrega mais que o KVM 8 único.

Ponto de atenção na opção B: o Redis deixa de ser `redis://redis:6379` na rede do Compose e passa
a trafegar entre hosts. Isso exige rede privada da Hostinger (não IP público), `requirepass` e
revisão do `REDIS_URL` nos dois lados. É o único trabalho de configuração real dessa separação.

### Sobre GPU

Correto não considerar GPU, e vale registrar o motivo para não voltar à discussão: **nenhuma
inferência roda nesta infraestrutura.** Classificação e extração vão para a Groq por HTTP
(`server/ai/services/groqClient.ts`) e o OCR vai para o Google Vision
(`server/ai/vision/visionOcrService.ts`). Do ponto de vista do VPS, IA é I/O de rede — o consumo
local é de espera, não de cálculo.

O único CPU pesado é o **Ghostscript**, que é rasterização de PDF e não se beneficia de GPU nesse
uso. Portanto: mais núcleos de CPU, sim; GPU, não — em nenhum tier.

Isso só mudaria se a decisão de produto de trocar Groq por modelos auto-hospedados voltasse à mesa
(hoje `docs/ARCHITECTURE_SCALE.md` §17 prevê migrar para Google Vision AI, que também é serviço
gerenciado). Enquanto a inferência for remota, GPU é gasto sem retorno.

### Ordem de compra recomendada

1. **Primeiro, um KVM 4 só para workers.** Maior efeito por real gasto: libera os 2 núcleos atuais
   inteiros para a API e permite subir a concorrência sem penalizar requisição de usuário. Os
   workers só precisam de Redis e R2 — **nenhuma mudança de código**, só rede e `.env`.
2. **Depois, promover a máquina de aplicação** de KVM 2 para KVM 4, quando os gatilhos do Passo 8
   dispararem.
3. **Réplicas de API só depois de (2)** — nunca antes, e nunca antes do Passo 9.

Comprar na ordem inversa (um KVM 8 único) gasta mais e resolve menos: os workers continuariam
competindo com a API pelos mesmos núcleos, que é exatamente o problema de hoje — só que mais caro.

**Enquanto a compra não acontece**, o Passo 1 já entrega a maior parte do ganho disponível no
KVM 2: a concorrência 2/1/1 deixa de estrangular a máquina, e os limites impedem que um pico de
worker mate o Postgres. Nada aqui está bloqueado esperando hardware.

### Ao trocar de hardware, revisar

- As três variáveis de concorrência, pelas regras de derivação do Passo 1.
- Os `mem_limit`/`cpus` do Compose e os `--max-old-space-size` correspondentes.
- `MONGODB_MAX_POOL_SIZE` (hoje 50) — com mais réplicas de API, o total de conexões ao Atlas é
  `réplicas × pool`, e o tier tem teto de conexões.
- `PGBOUNCER_DEFAULT_POOL_SIZE` (hoje 25) contra o `max_connections` do Postgres.

---

## Passo 8 — Gate de capacidade: quando sair de 8 GB / 2 vCPU

**Objetivo:** decidir com dado, não com susto, o momento de crescer o hardware.

Este passo substitui o "réplicas da API" da v1.0 do plano. **Nesse hardware, réplicas não
entregam throughput** — 3 processos Node já disputam 2 núcleos. O `DOQYN_API_REPLICAS` do Compose
deve permanecer em **1** até a máquina mudar.

O **quê** comprar e em que ordem está na seção *Dimensionamento e crescimento de hardware*
(escada Hostinger KVM 2 → KVM 4 dedicado a workers → KVM 4 de aplicação). Este passo define
apenas o **quando**.

Resumo da ordem, para não precisar voltar: (1) KVM 4 só para workers, (2) promover a máquina de
aplicação, (3) réplicas de API — nunca antes de (2) nem antes do Passo 9. Em paralelo, mover o
Postgres do auth para instância gerenciada quando `auth_sessions` virar a tabela mais quente
(o Passo 10 reduz muito essa pressão e provavelmente adia isso indefinidamente).

**Gatilhos objetivos para acionar a compra do item 1** — qualquer um sustentado por uma semana:

| Sinal | Limiar |
|-------|--------|
| Load average (2 vCPU) | > 1,8 em regime |
| p95 de `GET /api/documents` | > 800 ms |
| Profundidade da fila de análise | > 50 jobs por mais de 15 min |
| Memória usada / limite em qualquer container | > 85% |
| Swap em uso | > 500 MB de forma sustentada |

**Pronto quando:** os gatilhos estiverem instrumentados e alarmados, com dono definido para agir.

---

## Passo 9 — Upload e download diretos no R2

**Objetivo:** o binário deixa de passar pela API. Com 1 GB de limite no container e 2 vCPU, é o
passo que mais alivia a máquina.

**Boa notícia — metade já está construída e apenas desligada.** O caminho presigned existe
ponta a ponta para o fluxo de *análise*, atrás de flag (`PRESIGNED_UPLOAD_ENABLED=false`,
`VITE_PRESIGNED_UPLOAD_ENABLED=false`):

| Camada | Arquivo |
|--------|---------|
| Config | `server/storage/presignedUploadConfig.ts` |
| URLs | `server/storage/r2/r2PresignedUrls.ts` |
| Staging | `server/services/analysis/analysisStagingUploadService.ts` |
| Ingress | `server/services/analysis/analyzePdfIngress.ts` |
| Cliente | `src/features/document-send/services/analyzePdf.ts:423` |

O que **não** está coberto é justamente `api/documents/upload.ts` — o upload principal de
documento, que segue no parser artesanal. Este passo é portanto **estender um padrão que já
funciona**, não construir do zero: replicar o fluxo de `analyzePdf.ts` no upload de documento e
ligar as duas flags.

**Arquivos:** `api/documents/upload.ts`, `src/features/upload/`,
`server/storage/r2/r2StorageProvider.ts` (`streamToBuffer`, linhas 36-45, 204, 390)

**Mudança:** duas metades do mesmo problema.

- **Upload:** PUT pré-assinado. O cliente pede a URL, envia direto ao R2 e confirma metadados. A
  API nunca toca no byte. Fecha o C3.
- **Download:** onde o objeto só será devolvido ao cliente, emitir GET pré-assinado e redirecionar
  em vez de `streamToBuffer`. Fecha o M9. Onde o buffer é necessário de fato (worker lendo PDF),
  manter — mas isolado no worker.

`docs/ARCHITECTURE_SCALE.md` seção B.5 já prevê upload por presigned URL; este passo é a execução
dela, estendida ao download.

**Validação:** durante upload de 100 MB, a memória do container `doqyn-api` não sobe
proporcionalmente ao arquivo.

**Pronto quando:** o pico de memória da API independe do tamanho do arquivo, no upload e no
download.

**Commit:** `feat(storage): move document upload and download to presigned R2 URLs`

---

## Passo 10 — Sessão: TTL longo com invalidação por evento

**Objetivo:** desacoplar a disponibilidade do Alpha da do auth-api e tirar carga do Postgres local.

**Arquivos:** `server/auth/sessionCache.ts` (linha 22); no auth-service,
`src/modules/sessions/sessionsRevoke.service.ts` e `src/modules/auth/auth.service.ts`

**Mudança:** `SESSION_CACHE_TTL_SECONDS` tem padrão **45**. Com 4.000 empresas e 5 usuários ativos
cada, são 20 mil sessões revalidando a cada 45s — cerca de **440 chamadas/s** a
`/internal/sessions/verify`, cada uma batendo no PostgreSQL via PgBouncer. **Nesse hardware o
Postgres tem 0,5 vCPU e 1 GB**: 440 req/s de verify é carga incompatível com o orçamento do
Passo 1. Este passo não é otimização, é pré-requisito de viabilidade.

1. TTL de 5–15 minutos.
2. **Invalidação por evento**: o auth publica em canal Redis no logout, revogação de sessão e
   mudança de membership; o Alpha derruba a entrada na hora.
3. **Stale-while-revalidate**: indisponibilidade curta do auth serve a entrada vencida em vez de
   derrubar o produto.

O item 2 é o que preserva a segurança — sem ele, TTL longo significa sessão revogada continuar
valendo. **Não faça 1 sem 2.**

Cruza os dois repositórios; nomes de canal e payload entram no contrato de `docs/ENV_SYNC.md`.

**Validação:** logout em uma aba invalida o acesso nas outras em < 1s; derrubar o auth-api por 60s
não desloga usuários já autenticados; medir a queda no volume de `verify` e na CPU do
`postgres-auth`.

**Pronto quando:** revogação propaga em < 1s e a taxa de `verify` cai proporcionalmente ao aumento
do TTL.

**Commit:** `feat(auth): event-driven session invalidation with extended cache ttl`

---

## Passo 11 — Retenção de auditoria e quota fail-closed

**Objetivo:** parar o crescimento da maior coleção e fechar a porteira de quota.

**Arquivos:** `server/db/tenantIndexes.ts` (linhas 157-169),
`server/tenancy/tenantQuotas.ts` (linhas 88-92)

**Retenção (M7):** `auditLogs` tem **8 índices** e nenhuma política de retenção — a coleção que
mais cresce e a de maior custo de escrita, já que cada insert atualiza oito estruturas. No Atlas,
isso é também custo de armazenamento mensal.

1. Índice TTL com retenção quente de 90–180 dias.
2. Arquivamento do histórico frio em R2 (NDJSON ou Parquet) para consulta sob demanda.
3. Revisar quais dos 8 índices são de fato usados — provavelmente dois ou três cobrem tudo. Decida
   com `$indexStats`, não por intuição:

```js
db.audit_logs_<prefix>.aggregate([{ $indexStats: {} }])
```

**Quota (M8):** `assertTenantQuota` retorna sem bloquear quando o Redis está indisponível
(`if (usage === null) return;`). Redis fora significa nenhum limite para nenhum tenant, exatamente
quando o sistema está mais frágil — e nesse hardware, sem limite de upload, a máquina cai. Tornar
explícito por variável (`TENANT_QUOTA_FAIL_MODE=open|closed`), padrão `closed` em produção, com
contador local em memória como rede de proteção e alarme imediato.

**Validação:** derrubar o Redis em staging e confirmar que uploads passam a ser recusados com
`429`, não aceitos sem limite.

**Pronto quando:** o tamanho de `auditLogs` estabiliza numa janela previsível e a falha de Redis
resulta em recusa controlada com alarme.

**Commit:** `feat(audit): ttl retention and index pruning` + `fix(quota): fail closed without redis`

---

## Passo 12 — Preview sob demanda

**Objetivo:** parar de gastar o recurso mais caro do sistema com documentos que ninguém abre.

**Arquivos:** `server/services/preview/documentPreviewScheduling.ts`,
`server/services/confirmAnalysisService.ts:33`,
`server/services/confirmUpdateDocumentVersionService.ts:27`,
`server/services/signatures/promoteSignedPdfToDocumentVersion.ts:10`

**Mudança:** hoje o preview é enfileirado **eagerly** — todo documento confirmado gera um job de
Ghostscript, independentemente de alguém vir a abri-lo. Numa base de gestão documental a maioria
dos arquivos é arquivada e nunca visualizada, então boa parte desse CPU é desperdício direto. E
CPU é justamente o que define o tamanho (e o preço) do VPS.

Passar para geração na primeira visualização:

1. No confirm, **não** enfileirar; marcar a versão como `preview: { status: 'pending' }`.
2. No endpoint de preview, se não houver artefato pronto, enfileirar com prioridade alta e
   responder `202` — a UI já sabe lidar com estado de processamento.
3. Cachear o resultado no R2 normalmente; a partir da segunda visualização é servido direto.
4. Opcional: manter eager apenas para documentos assinados, que quase sempre são consultados.

**Antes de implementar, meça** — o ganho depende inteiramente deste número:

```js
// que fração dos documentos recebeu ao menos um preview_viewed em 30 dias
db.audit_logs_<prefix>.distinct('documentId', {
  action: 'document.preview_viewed',
  createdAt: { $gte: new Date(Date.now() - 30*864e5) }
}).length
// dividir pelo total de documentos criados na mesma janela
```

Abaixo de 50%, o ganho é grande e óbvio. Acima de 80%, o passo perde sentido — mantenha eager.

**Pronto quando:** o número de jobs de preview por dia cai proporcionalmente à fração medida, sem
regressão perceptível na experiência de abrir um documento.

**Commit:** `perf(preview): generate on first view instead of on every upload`

---

## Baseline a coletar antes do Passo 3

Sem isto, nenhum ganho é demonstrável:

| Métrica | Como medir | Valor inicial |
|---------|-----------|---------------|
| **Coleções no Atlas** | `db.getCollectionNames().length` — contra o teto de **500** do M0 | |
| **Armazenamento usado** | `db.stats().dataSize` — contra o teto de **512 MB** do M0 | |
| **% de documentos com preview aberto em 30d** | consulta do Passo 12 — decide se vale o corte | |
| **CPU-segundos por preview (`C`)** | `/usr/bin/time -v gs ...` — ver seção de dimensionamento | |
| **Documentos por dia (real)** | contagem em `documents` por janela de 24h | |
| Load average em regime | `uptime` | |
| p95 do dashboard | Prometheus / log de request | |
| p95 de `GET /api/documents` | idem | |
| Consultas ao registry por request | profiler do Atlas | |
| Memória de pico do `doqyn-api` | `docker stats` sob upload | |
| **Namespaces no Atlas** | script do Passo 0 | |
| **Tier do Atlas e limite de namespaces** | painel Atlas | |
| Chamadas/s a `/internal/sessions/verify` | log do auth-api | |
| Tamanho de `auditLogs` | `db.stats()` por tenant | |

---

## Referências

- `docs/ARCHITECTURE_SCALE.md` — estratégia (v1.0, 2026-07-11)
- `docs/DEPLOY_VPS.md` — topologia de produção; container `mongo` não sobe (Atlas)
- `docs/MONGODB_TENANT_ISOLATION.md` — regras de isolamento
- `docs/TENANT_STORAGE_MODEL.md` — modelo de storage por tenant
- `docs/ENV_SYNC.md` — contrato de variáveis entre os dois repos
- `CLAUDE.md` — restrições de deploy e convenções do projeto
