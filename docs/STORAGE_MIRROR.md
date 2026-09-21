# Espelho do acervo (segundo storage S3)

Uma segunda cópia de cada versão de documento, num storage compatível com S3, para o documento
continuar abrindo se o R2 sair do ar.

## O que ele é, e o que ele não é

**É fallback de disponibilidade.** Se o R2 não responder, a leitura cai no espelho e o documento
abre.

**Não é backup.** Espelho na mesma máquina que roda a aplicação morre junto com ela. Se a garantia
desejada for contra perda de dados, aponte `STORAGE_MIRROR_ENDPOINT` para outro provedor
(Backblaze B2, Wasabi, S3) — é o mesmo caminho de código, muda só endpoint e credencial.

## Como funciona

O upload do navegador vai **direto para o R2** por URL assinada; o servidor nunca vê os bytes no
caminho de envio. Não existe, portanto, "gravar nos dois ao mesmo tempo". A sequência é:

1. A confirmação grava a versão no endereço provisório (`tmp/`).
2. A fila `document-storage-promotion` copia para a chave definitiva e atualiza o Mongo.
3. **Só então** o job `mirror` lê do R2 e grava no espelho, na mesma chave.

O espelho é sempre o último da fila: só faz sentido copiar o que já ficou de pé. Falhar ali não
desfaz nada — o documento já está no acervo e servido pelo R2; o que se perde é a cópia, e o BullMQ
tenta de novo.

**Preview e miniatura também são espelhados**, mas por outro caminho: eles são gerados no
servidor, que já tem os bytes em mãos, então a cópia é feita na hora da gravação, sem fila. É
best-effort de propósito — preview é dado derivado, e se o espelho perder um, ele se refaz a partir
do original. Derrubar a geração do preview, que é o que a pessoa está esperando na tela, para
salvar uma cópia reconstruível seria trocar o certo pelo duvidoso.

A leitura de preview delega para a leitura de versão, então o fallback vale para os dois sem código
repetido — e sem um segundo caminho de leitura para alguém esquecer de proteger.

## Mesmas regras de bucket do R2

O espelho não tem endereçamento próprio: ele copia o do R2, bucket e chave.

**Bucket por tenant PJ.** Quando um tenant PJ nasce, o R2 ganha um bucket próprio,
`doqyn-{env}-t-{slug}-{hash}`, função pura do `tenantId` — e o espelho ganha um bucket de mesmo
nome, criado na primeira gravação e com **a mesma política de CORS** aplicada. As funções usadas
são literalmente as do R2 (`headTenantBucket`, `createTenantBucket`, `ensureBucketCors`), porque
duplicar a regra criaria dois lugares para a política mudar e um ficaria para trás.

**Bucket compartilhado para PF.** Tenant pessoa física não ganha bucket: cai no compartilhado, sob
o prefixo opaco `individuals/{hash}` que nunca contém CPF, e-mail ou nome. O espelho repete isso.

Por que não um bucket único do espelho: o nome do bucket **é** a fronteira de isolamento no desenho
atual. Achatar tudo numa pilha só manteria o tenant na chave, mas apagaria a fronteira que permite
política e credencial por tenant — e aí o espelho deixaria de ser espelho.

Um detalhe que morde: `ensureBucketCors` tem cache por processo indexado só pelo nome do bucket, e
o nome no espelho é o mesmo do R2 de propósito. Por isso o espelho mantém memo próprio e chama com
`force: true`; sem isso, verificar o bucket do original marcaria o do espelho como pronto, e ele
passaria a vida sem CORS e talvez sem existir.

A leitura não provisiona: se o bucket não existe no espelho, não há cópia, e criar um vazio só
esconderia isso atrás de um "não encontrado".

## Segurança

- **O MinIO não publica porta.** No `docker-compose.production.yml` ele não tem `ports:`; fica só na
  rede interna do Compose. Para abrir o console, use túnel SSH. Publicar a 9000 na internet
  exporia o acervo inteiro atrás de uma senha de variável de ambiente.
- **`MINIO_BROWSER=off` por padrão.** O console web não sobe a menos que você peça.
- **`http://` só para host interno.** `checkMirrorEndpoint` recusa `http://` para host público:
  mandaria credencial e documento em texto claro pela rede aberta. Dentro do Compose
  (`http://minio:9000`) o tráfego não sai da máquina e é aceito.
- **Credencial na URL é recusada.** Ela vazaria em log de requisição e em mensagem de erro do SDK.
- **Configuração pela metade não liga.** Endpoint sem credencial enfileiraria jobs que falham para
  sempre, e o acervo pareceria espelhado sem estar. Falta qualquer variável, segue desligado com
  aviso no log.
- **O fallback de leitura mora dentro do provedor de storage**, depois que o serviço já checou
  tenant e permissão do documento. Ele não abre porta que o caminho normal não abrisse. Não mova
  essa chamada para uma camada acima.
- **A checagem de credencial do MinIO mora no `command`, não em `${VAR:?}`.** O Compose interpola
  todos os serviços, inclusive os que estão atrás de profile: um `:?` ali derrubaria qualquer deploy
  normal por causa de um serviço que nem ia subir. No `command`, ela dispara só quando o MinIO
  inicia de verdade — e precisa existir, porque sem credencial o MinIO cai no par padrão
  `minioadmin:minioadmin`, que é senha pública.
- **Os repositórios são públicos.** Nenhuma dessas credenciais pode encostar num commit; elas vivem
  só no `deploy/.env` da máquina.

## Variáveis

No `.env.example` e no `deploy/.env` gerado pelo setup (a flag sai `false`):

```bash
# Espelho do acervo — nasce desligado. Ligue só quando houver disco para o acervo inteiro.
STORAGE_MIRROR_ENABLED=false
STORAGE_MIRROR_ENDPOINT=http://minio:9000
STORAGE_MIRROR_REGION=us-east-1
STORAGE_MIRROR_KEY_PREFIX=
STORAGE_MIRROR_ACCESS_KEY_ID=
STORAGE_MIRROR_SECRET_ACCESS_KEY=
# MinIO só serve path-style; provedor de nuvem costuma aceitar os dois.
STORAGE_MIRROR_FORCE_PATH_STYLE=true
# Acima disto o arquivo não é espelhado — protege o disco de quem hospeda o espelho.
STORAGE_MIRROR_MAX_OBJECT_MB=100
STORAGE_MIRROR_REQUEST_TIMEOUT_MS=60000

# Só para o serviço minio do Compose
MINIO_BROWSER=off
MINIO_MEM_LIMIT=512m
MINIO_CPUS=0.3
```

`STORAGE_MIRROR_ACCESS_KEY_ID` e `STORAGE_MIRROR_SECRET_ACCESS_KEY` são usadas pelos dois lados: o
MinIO as recebe como `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, e a aplicação as usa como credencial
S3. Gere-as com `openssl rand -hex 24`.

## Ligando, passo a passo

Antes de tudo, confira o disco. Espelhar todo o acervo faz o disco da máquina virar o teto de
armazenamento do produto:

```bash
df -h /
```

Depois, no `deploy/.env` da VPS:

1. Confirme `STORAGE_MIRROR_ACCESS_KEY_ID` e `STORAGE_MIRROR_SECRET_ACCESS_KEY` (o
   `setup-production-env.sh` já gera o par e o deixa no `.env`, com a flag ainda em `false`).
2. `STORAGE_MIRROR_ENABLED=true`
3. Rode o deploy normal (`./deploy/scripts/deploy-production.sh`). O wrapper do Compose passa
   `--profile mirror` **só quando a flag é true** — não precisa lembrar o profile na mão.

Quem for subir o MinIO isolado, sem o wrapper:

```bash
cd deploy && docker compose -f docker-compose.production.yml --env-file .env --profile mirror up -d minio
```

Não há passo de criar bucket à mão: cada bucket nasce na primeira gravação daquele tenant, com o
mesmo nome e a mesma política de CORS do R2.

A partir daí, **todo arquivo novo** é espelhado. O que já está no R2 não é copiado
retroativamente — o backfill é um passo à parte, e vale decidir se ele é necessário depois de
medir quanto disco o acervo atual ocupa.

## Próxima sessão (ligar na VPS)

O código e o Compose já estão no repositório. O que falta é operação na máquina:

1. Puxar a branch que contém este trabalho e rebuild de `doqyn-api` + `doqyn-worker` (o worker de
   promoção é quem enfileira o `mirror`).
2. `df -h /` — o disco da VPS vira o teto do acervo.
3. Se o `.env` da VPS foi gerado **antes** deste bloco existir, copiar as variáveis de
   `.env.example` (ou de `setup-production-env.sh`) para `deploy/.env` e gerar o par de chaves.
   Não commitar esse arquivo; os repositórios são públicos.
4. `STORAGE_MIRROR_ENABLED=true` e `./deploy/scripts/deploy-production.sh`.
5. Confirmar `docker compose ... ps` com o serviço `minio` saudável e, no log da API/worker,
   `storage mirror job completed` depois de um upload novo.
6. Decidir se precisa backfill do que já está no R2 — não vem ligado.

Se a garantia desejada for contra perder a VPS (não só contra o R2 cair), mude
`STORAGE_MIRROR_ENDPOINT` para outro provedor. O MinIO local não resolve isso.

## Desligando

`STORAGE_MIRROR_ENABLED=false` e reinicie a API e o worker. Nenhum job novo é enfileirado, e o
fallback de leitura volta a não existir. Os objetos já espelhados continuam no MinIO até alguém
apagá-los.

## Observando

No log da aplicação:

- `storage mirror job completed` com `outcome` em `mirrored`, `already_present`,
  `skipped_too_large`, `disabled` ou `skipped`.
- `objeto acima do teto do espelho — não espelhado` quando o arquivo passa de
  `STORAGE_MIRROR_MAX_OBJECT_MB`.
- `documento servido pelo espelho: leitura no R2 falhou` — este é o que importa. Se ele aparecer,
  o R2 teve problema e o espelho cumpriu o papel.
- `espelho de storage ligado mas incompleto` ou `recusado pelo endpoint` — configuração errada; o
  espelho está desligado apesar da flag.
