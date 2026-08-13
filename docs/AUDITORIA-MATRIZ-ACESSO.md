# Auditoria da matriz de acesso (grupo × classe)

Verificação empírica feita em 2026-08-13 contra o tenant demo `company_vertex_engenharia_e_projetos_0d6dd3`
(ver `CONTA-DEMO-VERTEX.md`), com quatro usuários em quatro grupos e três documentos de dois donos
diferentes. Cada verbo da matriz foi configurado isoladamente e o efeito medido pela API real.

Resumo: **`view` e `download` funcionam; `upload` (atualizar) funciona; `share` e `manage` (auditar)
não concedem nada a ninguém.** Além disso, o endpoint que grava a matriz aceita chaves inexistentes
e responde `200`, produzindo regra que não faz nada.

## O que funciona

A listagem é filtrada corretamente pela matriz, e detalhe/preview/download concordam com ela:

| Usuário | Grupo | Lista | Documento fora do grupo |
|---|---|---|---|
| Helena, Ricardo | Diretoria (tudo) | 3 de 3 | — |
| Marcos | Engenharia | 1 de 3 | `403` em detalhe, preview e download |
| Juliana | Financeiro | 2 de 3 | `403` no jurídico alheio |

As permissões granulares reportadas na listagem também respeitam a matriz: com `upload:false` em
Contratos, Juliana recebe `canEditMetadata:false` e `canUpdate:false` no contrato do Marcos.

O dono sempre enxerga e controla o próprio documento, mesmo sem regra que o autorize — Juliana lê o
NDA que ela mesma enviou apesar de o grupo Financeiro não ter acesso à classe Jurídico. Isso é
deliberado (`isOwner` em `server/tenancy/documentAccess.ts:87`, decisões D-04 e D-20), mas vale
saber que **o admin não consegue tirar do autor o controle do próprio documento**, nem em tenant PJ.

## Defeito 1 — o verbo `share` nunca concede permissão

`canUserShareDocument` (`server/tenancy/documentShareAccess.ts:23`) recebe `governanceIndex` como
quarto parâmetro, mas **nenhum dos cinco call sites o passa**:

| Arquivo | Linha | Efeito |
|---|---|---|
| `server/services/sharing/documentShareService.ts` | 148, 211, 374 | compartilhar, listar e revogar compartilhamento interno |
| `server/services/sharing/externalDocumentShareService.ts` | 153 | compartilhamento externo (link público) |
| `server/services/signatures/documentSignatureService.ts` | 351 | solicitação de assinatura |

Sem o índice, `userHasGovernanceCategoryPermission(undefined, …)` devolve `false` e a função cai no
fallback `resolveDocumentPermissions(…).canUpdate`, que também fica `false` pelo mesmo motivo.
Sobram `isAdmin` e `isOwner`.

Medido com `share:true` explícito e `upload:false`, para o fallback não mascarar o resultado:

```
matriz: Financeiro em Contratos = view + download + share, sem upload
  lista reporta canShare = true
  POST /api/documents/:id/shares -> 403 DOCUMENT_SHARE_DENIED
  GET  /api/documents/:id/shares -> 403 DOCUMENT_SHARE_DENIED
```

Note a segunda linha: a listagem **passa** o índice e reporta `canShare:true`, então a interface
habilita a ação que o servidor recusa. O usuário clica em compartilhar e toma 403.

Correção: passar o índice de governança nos cinco call sites, como
`server/services/documentService.ts` já faz ao montar a listagem.

## Defeito 2 — o verbo `manage` (auditar) nunca concede permissão

`canViewDocumentTracking` (`server/auth/permissions.ts:45`) decide só por papel e posse:

```ts
if (isDocumentAdmin(user)) return true;
return Boolean(scope?.ownerUserId && scope.ownerUserId === userId);
```

Não recebe nem consulta a matriz. Medido com `manage:true` para o grupo Engenharia na classe
Jurídico, com Marcos que não é dono do documento:

```
GET /api/documents/:id           -> 200   (view concedido)
GET /api/documents/:id/timeline  -> 403 TRACKING_FORBIDDEN
  permissões reportadas: canViewTracking: false
```

O admin marca "auditar" no mapa de regras e nada acontece. Diferente do defeito 1, aqui a listagem
também reporta `false` — servidor e interface concordam, mas ambos ignoram a configuração do tenant.

Correção: `canViewDocumentTracking` precisa aceitar `classId` + `memberGroupIds` + índice e
consultar `auditByCategory`, como `resolveDocumentPermissions` faz para `view`/`download`/`update`.

## Defeito 3 — `PUT /api/document-rules/matrix` aceita chave inexistente

O handler (`api/document-rules/matrix.ts:34`) tipa o corpo como `DocumentAccessPermissions` mas não
valida nada em tempo de execução, e `upsertAccessRule` grava o objeto cru. O campo persistido é
`{view, download, upload, share, manage}` (`server/db/types.ts:333`) — `upload` significa "atualizar"
e `manage` significa "auditar", nomes herdados do primeiro desenho e traduzidos em
`server/tenancy/governanceAccessIndex.ts:27`.

Enviar `{view, download, update, audit, share}` — os nomes do domínio, que é como o `GET` da própria
matriz devolve os dados — resulta em:

- `200 OK` na resposta;
- regra gravada no Mongo com as chaves erradas;
- `GET /document-rules/matrix` devolvendo exatamente o que foi enviado, então a tela mostra
  "atualizar" e "auditar" marcados;
- `updateByCategory` e `auditByCategory` vazios no índice, porque leem `upload` e `manage`.

Ou seja, a regra existe, aparece marcada na interface e não concede nada. A tela `/rules` não cai
nessa armadilha porque `src/features/rules/api/rulesApi.ts:401` usa as chaves legadas, mas qualquer
integração escrita a partir da resposta do `GET` cai.

Correção: validar `permissions` com Zod no handler, recusando chave desconhecida com `400` — ou
aceitar os dois vocabulários e normalizar antes de gravar.

## Como reproduzir

Os experimentos foram feitos por HTTP contra `localhost:3001`, autenticando em `127.0.0.1:4100`
com as contas da Vertex. A receita: alterar uma célula com `PUT /api/document-rules/matrix`,
exercitar o endpoint correspondente com o usuário do grupo, restaurar a célula ao final. Vale
lembrar que o auth-service limita login a 10 tentativas por IP a cada 15 minutos
(`src/security/rateLimit.ts:12`), então convém guardar o cookie entre execuções.
