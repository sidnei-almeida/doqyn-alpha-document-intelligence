# O que sobrevive ao desligamento de um funcionário

> **Os defeitos 1, 2 e 3 foram corrigidos em 2026-08-13.** O diagnóstico fica como registro; o
> estado de cada um está no fim da respectiva seção, e a verificação depois da correção está em
> "Depois da correção".

Investigação de 2026-08-13 contra o tenant demo `company_vertex_engenharia_e_projetos_0d6dd3`.
Método: uma funcionária (`juliana.prado@`) cria os dois tipos de compartilhamento, o membership dela
é bloqueado pela API de admin do auth-service, e cada caminho de acesso é medido antes e depois.
Bloqueio e desbloqueio são reversíveis, então o tenant volta ao estado anterior.

Resumo: **o acesso da pessoa é cortado na hora, mas tudo que ela concedeu a terceiros continua
valendo.**

## O que funciona

`removeMember` e `blockMember` (`doqyn-auth-service/src/modules/admin/membersAdmin.service.ts:278`
e `:462`) marcam o membership e chamam `revokeSessionsByActiveMembership`. O verify da sessão só
aceita membership `active` em tenant `active` (`src/modules/auth/auth.service.ts:157`), então nem a
sessão viva nem um login novo devolvem acesso:

```
sessão da desligada, depois do bloqueio -> 401
```

O `isOwner` não é brecha aqui: sem membership a requisição morre antes da camada de permissão.

## Defeito 1 — o link externo sobrevive ao desligamento

`resolveExternalShareAccess` (`server/services/sharing/externalDocumentShareService.ts:483`) valida
revogação, expiração, janela de acesso e disponibilidade do documento. **Não olha o vínculo de quem
concedeu.** Medido com o convite já aceito (grant `active`), acessando sem nenhum cookie:

```
ANTES  do desligamento: view 200 | download 200
bloqueio do membership -> 200        (sessão dela passa a 401)
DEPOIS do desligamento: view 200 | download 200
```

Um terceiro fora da empresa continua **baixando o arquivo** depois que quem lhe deu acesso foi
desligado. O vínculo que autorizava a concessão deixou de existir e a concessão seguiu de pé.

## Defeito 2 — não há teto para a validade do link

`createDocumentExternalShareGrant` (mesma classe, linha 245) só recusa data no passado:

```ts
if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) { … }
```

O default é 7 dias (`server/config/externalSharingConfig.ts:11`), mas o cliente escolhe qualquer
`expiresAt`. Um link com validade de **dez anos** foi aceito sem reclamação:

```
criação do link -> 200 | expira em 2036-08-10
```

Somado ao defeito 1: alguém prestes a sair pode criar links de validade indefinida e eles
sobreviverão ao desligamento. Não é preciso má-fé — basta o hábito de "coloca um prazo longo para
não vencer no meio do projeto".

## Defeito 3 — o compartilhamento interno também sobrevive

Mesmo resultado no compartilhamento entre colegas: o grant concedido pela funcionária continua ativo
depois do bloqueio dela, e o destinatário segue com o documento na lista:

```
documento para o destinatário, depois do desligamento -> 200
/api/shared-with-me/documents -> 1 documento
```

Menos grave que o externo, porque o destinatário ainda é da empresa. Mas o efeito colateral é real:
o grant é justamente o mecanismo que dá acesso a **quem a matriz não daria**, e ele passa a ser um
acesso que ninguém revisou, concedido por alguém que não está mais lá.

## A correção

Duas frentes, independentes, ambas implementadas:

**1. Cortar as concessões no desligamento.** `revokeSharesGrantedByMembership`
(`server/services/sharing/membershipShareRevocationService.ts`) revoga os grants — internos e
externos — concedidos por um `userId` dentro do tenant, exposto em
`POST /api/internal/memberships/revoke-shares` e autenticado pela chave interna do app, mesmo
desenho de `/api/internal/tenants/provision`. Do outro lado, `removeMember` e `blockMember`
(`doqyn-auth-service`) chamam esse endpoint logo depois de revogar as sessões, e o resultado entra
no metadata da trilha (`sharesRevoked` ou `sharesRevocationFailed`).

A falha da chamada **não** derruba o desligamento: cortar a sessão é a parte urgente, e o app
principal fora do ar não pode impedir um bloqueio de segurança. Por isso a falha vai para a trilha
em vez de virar exceção. A operação é idempotente — o filtro só pega grant vivo.

**2. Teto de validade.** `assertExpirationWithinLimit` recusa data inválida, no passado, ou além de
`maxExternalShareExpirationDays` (`server/config/externalSharingConfig.ts`, default 90 dias,
ajustável por `EXTERNAL_SHARE_MAX_EXPIRATION_DAYS`). Vale na criação e na regeneração do convite.

## Depois da correção

Mesmo roteiro de antes, medido de novo:

```
teto de validade
  10 anos -> 400 EXPIRES_AT_ABOVE_LIMIT
  30 dias -> 201

link externo (terceiro sem login)
  ANTES  do desligamento: view 200 | download 200
  DEPOIS do desligamento: view 403 | download 403

compartilhamento interno (usuário comum, sem acesso pela matriz)
  sem grant algum     -> 403
  com grant           -> 200, aparece em /shared-with-me
  após o desligamento -> 403 DOCUMENT_ACCESS_DENIED, some da lista
```

O caso interno precisa de um usuário comum para dizer alguma coisa: medido com um `company_admin`,
o acesso continua em 200 depois da revogação — mas por causa do papel, não do grant.

Guardas de regressão em `tests/offboarding-share-revocation.test.ts`.

## O que ficou de fora

Uma tela de compartilhamentos ativos do tenant, para o admin ver o que está aberto e para quem.
Hoje a listagem é por documento, então não existe visão do conjunto — ninguém descobre um link
esquecido sem abrir documento por documento. Com a revogação em cascata e o teto de validade o
risco cai bastante, mas a falta de visibilidade continua.

## Achado lateral

`POST /auth/admin/members/:membershipId/block` com um `membershipId` que não é UUID devolve **500**
com o erro do Zod no corpo da resposta, em vez de `400`. Vazamento de detalhe interno e status
errado para o que é erro do cliente.

## Reproduzir

Os dois roteiros usados estão descritos aqui; a receita é criar o grant, aceitar o convite (o grant
nasce `pending` e só permite download depois de `active`), bloquear o membership por
`/auth/admin/members/:id/block`, medir, e desfazer com `/unblock`. O par e-mail ↔ membershipId sai
de `GET /api/company-members`, que devolve o identificador no campo `id`.
