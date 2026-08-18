# Deploy em VPS (Docker Compose)

Stack de produção do DOQYN: auth (PostgreSQL), API principal (MongoDB), **Redis**, **worker de análise**, Nginx (SPA + proxy).

## Pré-requisitos

- **SO alvo:** Ubuntu **24.04 LTS** (VPS Hostinger ou equivalente)
- **Docker Engine** 24+ e plugin **Compose** v2 (`docker compose`, não `docker-compose` legado)
- Repositórios lado a lado:
  - `doqyn-auth-service`
  - `doqyn-alpha-document-intelligence`
- **Domínio apontado para a VPS + TLS na frente** — não é opcional, ver abaixo

### Domínio e TLS são pré-requisito, não acabamento

O auth-service marca o cookie de sessão como `Secure` sempre que `NODE_ENV=production`
(`src/security/cookies.ts`) — **não há variável que desligue isso**. Navegador descarta
cookie `Secure` em origem `http://`.

Consequência prática: subir a stack e abrir `http://<IP-da-VPS>` **não loga**. O login
completa no servidor, o cookie é descartado no caminho, e a tela volta para o login sem
mensagem de erro em lugar nenhum. `COOKIE_DOMAIN` apontando para um domínio que não bate
com o host acessado tem o mesmo efeito.

Ordem correta: DNS apontado → TLS na frente (Cloudflare com proxy laranja é o mais
simples na Hostinger) → `setup-production-env.sh` com a URL `https://` → deploy.

`setup-production-env.sh` avisa e pede confirmação se a URL não for `https://`, e
`validate-vps-ready.sh` falha (exit 1) nesse caso.

### Ubuntu 24.04 — notas rápidas

| Tópico | Recomendação |
|--------|----------------|
| Docker | [Instalação oficial](https://docs.docker.com/engine/install/ubuntu/) (`docker-ce` + `docker-compose-plugin`) |
| Porta 80 | **Não configure** `/etc/nginx` do Ubuntu. Rode `sudo ./deploy/scripts/prepare-ubuntu-host.sh` antes do deploy (automático no `deploy-production.sh`) |
| Nginx do sistema | Parar + desabilitar + mascarar; o DOQYN usa **nginx no Docker** (`deploy/nginx/default.conf`) |
| Firewall | `ufw allow 80/tcp` (e `443` se TLS no host); **não** abra 9090/3000 (Grafana/Prometheus ficam em localhost) |
| SSH | Necessário para deploy e túnel à observabilidade (`ssh -L 3000:127.0.0.1:3000 ...`) |

## Serviços

| Serviço | Função |
|---------|--------|
| `postgres-auth` | Banco do auth-service |
| `pgbouncer` | Pool de conexões Postgres (auth API) |
| `auth-api` | API de autenticação (via PgBouncer + rate limit Redis) |
| `mongo` | Dados da aplicação |
| `redis` | Cache de sessão, quotas e fila BullMQ |
| `doqyn-api` | API principal (`node dist/server/production-server.js`) |
| `doqyn-worker` | Processa jobs da fila `document-analysis` (`node dist/...`) |
| `doqyn-worker-preview` | Gera previews PDF/imagem (Ghostscript) via fila `document-preview` |
| `nginx` | SPA estática + proxy `/api` e `/auth` (least_conn, réplicas) |
| `prometheus` | *(profile observability)* Métricas e alertas |
| `grafana` | *(profile observability)* Dashboards |
| `redis-exporter` | *(profile observability)* Métricas Redis |

> Não há container `doqyn-web` separado: o frontend é servido pelo `nginx` a partir do build embutido na imagem.

### Réplicas (Fase B.4)

Por padrão na VPS (`setup-production-env.sh`):

| Variável | Padrão produção | Função |
|----------|-----------------|--------|
| `DOQYN_API_REPLICAS` | `1` | Instâncias `doqyn-api` |
| `AUTH_API_REPLICAS` | `1` | Instâncias `auth-api` |

> **Por que 1 e não 2:** numa VPS de 2 vCPU, cada réplica reserva CPU e RAM que os três
> processos Node (api, worker, worker-preview) já disputam entre si. Com 2/2 a soma de
> `mem_limit` passa de 6,8 GiB antes de contar Mongo local e observabilidade. Suba as
> réplicas junto com o plano da VPS, depois de medir — `validate-vps-ready.sh` avisa
> quando o valor não cabe no host.

O Nginx resolve `doqyn-api` e `auth-api` via DNS interno Docker (`resolve` + `least_conn`). O Prometheus descobre todas as réplicas da API com `dns_sd_configs`.

Ajustar réplicas após deploy:

```bash
# Edite deploy/.env e depois:
./deploy/scripts/scale-api-replicas.sh
```

Pré-requisitos para `>1` réplica: Redis (fila, cache e rate limit do auth) — já incluídos na stack.

### Upload presigned R2 (Fase B.5)

Com `PRESIGNED_UPLOAD_ENABLED=true` (padrão na VPS com R2):

1. `POST /api/documents/upload-url` — retorna URL assinada para staging (`tmp/{jobId}/...`)
2. Browser faz `PUT` direto no R2
3. `POST /api/ai/analyze-pdf` com JSON `{ jobId, originalFileName, mimeType, sizeBytes }` (sem multipart)

Configure **CORS no bucket R2** para permitir `PUT` da origem do app. Preview/download de documentos continuam via proxy autenticado (sem presigned de leitura).

| Variável | Padrão produção |
|----------|-----------------|
| `PRESIGNED_UPLOAD_ENABLED` | `true` |
| `PRESIGNED_UPLOAD_TTL_SECONDS` | `900` |
| `VITE_PRESIGNED_UPLOAD_ENABLED` | `true` (build nginx) |

### MongoDB Atlas (Fase B.6)

Produção recomendada: **MongoDB Atlas** em vez do container `mongo`.

| Variável | Atlas (`true`) | Docker local (`false`) |
|----------|----------------|------------------------|
| `MONGODB_USE_ATLAS` | `true` | `false` |
| `MONGODB_URI` | `mongodb+srv://...` | `mongodb://mongo:27017/doqyn_prod` |
| `MONGODB_DATABASE` | nome do cluster | `doqyn_prod` |
| Container `mongo` | **não sobe** | profile `local-mongo` |

No setup interativo (`setup-production-env.sh`), escolha **s** em “Usar MongoDB Atlas?”.

**Checklist Atlas antes da VPS:**

1. Cluster criado (ex.: M10+ na região da VPS)
2. **Network Access** — IP da VPS na allowlist (ou `0.0.0.0/0` só em teste)
3. Usuário com permissão no banco `MONGODB_DATABASE`
4. Após deploy: `./deploy/scripts/sync-mongodb-indexes.sh`

Dev local (como hoje): `MONGODB_USE_ATLAS=true` + URI Atlas no `.env` raiz — sem container mongo.

## Deploy rápido

```bash
cd doqyn-alpha-document-intelligence
./deploy/scripts/setup-production-env.sh   # primeira vez
./deploy/scripts/deploy-production.sh      # ou: ./deploy/start.sh (mesmo script)
```

`deploy-production.sh` é o único caminho suportado e faz tudo de uma vez:

1. Roda `validate-vps-ready.sh` **antes do build** — erro de `.env` aparece em segundos,
   não depois de 20 minutos compilando (`SKIP_VALIDATION=1` pula, num redeploy consciente)
2. Libera a porta 80 do nginx do Ubuntu
3. Constrói as imagens, aplica migrations, sobe a stack na ordem certa
4. **Verifica e afirma o estado no fim:** API, auth, deep health, todos os containers de
   pé, e a raiz servindo a SPA — não a página default do nginx

Se qualquer verificação falhar, o script diz qual passo, qual comando de diagnóstico
rodar, e **sai com código 1**. Deploy que termina em silêncio verde é deploy verificado.

## Variáveis importantes (Fase A)

Definidas em `deploy/.env` (ver `deploy/env/.env.production.example` ou `setup-production-env.sh`):

| Variável | Descrição |
|----------|-----------|
| `REDIS_URL` | Ex.: `redis://redis:6379` |
| `REDIS_ENABLED` | `true` em produção |
| `ANALYSIS_SYNC_FALLBACK` | `false` — análise via fila assíncrona |
| `ANALYSIS_QUEUE_CONCURRENCY_GLOBAL` | Jobs simultâneos no worker (padrão VPS: `2`; default do código: 10) |
| `ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT` | Slots por tenant (padrão VPS: `1`; default do código: 2) |
| `PREVIEW_QUEUE_CONCURRENCY_GLOBAL` | Ghostscript simultâneos (padrão VPS: `1`; default do código: 4) |
| `TENANT_QUOTA_ENABLED` | Controle de quotas por tenant |
| `TENANT_QUOTA_ANALYSIS_PER_DAY` | Limite diário de análises |
| `TENANT_QUOTA_UPLOADS_PER_HOUR` | Limite horário de uploads |

Template completo: `deploy/env/.env.production.example` (ou gere com `./deploy/scripts/setup-production-env.sh`).

## Health checks

- API: `GET /api/health`
- Deep health (Mongo, Redis, fila, auth, storage): `GET /api/health/deep`
- Worker: `pgrep -f runAnalysisWorker` no container `doqyn-worker`

## Prometheus

| Target | URL | Uso |
|--------|-----|-----|
| API | `GET /api/metrics` | Scrape via rede interna Docker (`doqyn-api:3001`); protegido por `METRICS_TOKEN` |
| Worker | `http://doqyn-worker:9100/metrics` | Porta interna do worker |
| Redis | `redis-exporter:9121` | Profile observability |

Métricas principais: `doqyn_http_requests_total`, `doqyn_http_request_duration_seconds`, `doqyn_session_verify_total`, `doqyn_analysis_queue_waiting`, `doqyn_analysis_jobs_total`, `doqyn_ai_provider_requests_total`, `doqyn_quota_exceeded_total`.

`/api/metrics` **não** é exposto publicamente pelo Nginx (retorna 403). O Prometheus faz scrape direto na rede Docker.

## Observabilidade (Prometheus + Grafana)

Stack opcional via profile Docker Compose. Portas bindadas apenas em `127.0.0.1` (acesso remoto via túnel SSH).

| Serviço | Porta local | Função |
|---------|-------------|--------|
| `prometheus` | `9090` | Scrape + alertas |
| `grafana` | `3000` | Dashboards |
| `redis-exporter` | interna | Métricas Redis |

### Subir observabilidade

Após o deploy principal:

```bash
./deploy/scripts/up-observability.sh
```

Ou automaticamente no deploy se `OBSERVABILITY_ENABLE=true` em `deploy/.env`.

> **Padrão é `false`.** Prometheus + Grafana + redis-exporter somam ~960 MiB de teto. Com
> Mongo local a stack passa de 7 GiB numa VPS de 8 GiB. Ligue quando tiver folga, ou rode
> com MongoDB Atlas.

Gerenciamento manual:

```bash
./deploy/scripts/up-observability.sh    # sobe Prometheus + Grafana
./deploy/scripts/down-observability.sh  # para só observabilidade
```

**Acesso:** portas bindadas em `127.0.0.1` — use túnel SSH para ver Grafana/Prometheus remotamente.

`setup-production-env.sh` gera:

- `METRICS_TOKEN` — Bearer para scrape da API
- `GRAFANA_ADMIN_PASSWORD` — login admin do Grafana

Arquivos locais (não commitar):

- `deploy/secrets/metrics_token`
- `deploy/observability/prometheus.generated.yml`

Sincronizar manualmente após editar `.env`:

```bash
./deploy/scripts/sync-observability-secrets.sh
```

### Túnel SSH (acesso ao Grafana na VPS)

```bash
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 user@sua-vps
```

Abra `http://localhost:3000` — usuário `admin`, senha em `GRAFANA_ADMIN_PASSWORD`.

Dashboard provisionado: **DOQYN — Overview**.

### Alertas

Regras em `deploy/observability/alerts/doqyn-alerts.yml` (fila acumulada, 5xx, cache de sessão, erros Groq, quotas).

## Validação pré-deploy

Antes de subir na VPS, rode localmente ou na máquina de staging:

```bash
./deploy/scripts/validate-vps-ready.sh
```

Verifica `.env`, variáveis críticas, `docker compose config` e (se a stack estiver rodando) health checks.

## Nginx do Ubuntu vs nginx do DOQYN (Hostinger)

Na VPS Ubuntu 24.04 costuma vir **nginx do sistema** na porta 80 (página default “Welcome to nginx”). Isso **conflita** com o container `nginx` do DOQYN.

| | Nginx do Ubuntu | Nginx do DOQYN |
|--|-----------------|----------------|
| Onde | `/etc/nginx/` no host | Container Docker (`deploy/nginx/default.conf`) |
| Configurar? | **Não** para o app | Já vem no repositório |
| Porta 80 | Deve ficar **livre** | Container publica `:80` |

### Liberar porta 80 (recomendado)

```bash
# Diagnóstico — o que está na porta 80?
sudo ./deploy/scripts/prepare-ubuntu-host.sh --check

# Parar, desabilitar e mascarar nginx/apache do sistema
sudo ./deploy/scripts/prepare-ubuntu-host.sh

# Se ainda falhar — remove pacotes (opcional)
sudo ./deploy/scripts/prepare-ubuntu-host.sh --purge
```

O `deploy-production.sh` chama esse script automaticamente quando `HTTP_PORT=80`.

### Erros comuns

| Sintoma | Causa | Solução |
|---------|-------|---------|
| `Bind for 0.0.0.0:80 failed` | nginx do Ubuntu na :80 | `sudo ./deploy/scripts/prepare-ubuntu-host.sh` |
| Página “Welcome to nginx” do Ubuntu | Host nginx ainda ativo | Mesmo script acima |
| Editou `/etc/nginx` e não funcionou | Proxy errado | Reverta; use só o nginx Docker |
| `502 Bad Gateway` no container | API ainda subindo | `compose logs doqyn-api` — aguarde health |

### TLS (HTTPS)

Com nginx **só no Docker**, opções:

1. **Cloudflare** (recomendado na Hostinger) — proxy laranja no DNS, HTTP na origem :80
2. **Certbot no host** — exige nginx no host como terminador (modo avançado; não é o padrão DOQYN)

## Logs

```bash
cd deploy
docker compose -f docker-compose.production.yml --env-file .env logs -f doqyn-api doqyn-worker redis
```

## TLS

O compose expõe HTTP na porta configurada (`HTTP_PORT`, padrão 80). Use Certbot no host, Cloudflare ou outro terminador TLS na frente do Nginx.
