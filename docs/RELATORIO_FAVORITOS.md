# Relatório — Sistema de Favoritos de Documentos

## Modelo de dados Mongo

**Coleção:** `user_document_favorites` (global/compartilhada do app documental)

**Schema (`MongoUserDocumentFavorite`):**
- `_id`, `userId`, `documentId`
- Metadados técnicos: `documentTenantId`, `documentTenantType`, `documentCollection`, `documentClassId`, `versionId`
- `createdAt`, `updatedAt`, `deletedAt?` (soft delete)

**Índices:**
- Unique parcial: `{ userId: 1, documentId: 1 }` (somente favoritos ativos)
- `{ userId: 1, deletedAt: 1, createdAt: -1 }`
- `{ documentId: 1 }`
- `{ userId: 1, documentTenantId: 1, deletedAt: 1 }`

Setup: `server/db/userDocumentFavoritesIndexes.ts` + `server/db/setupMongo.ts`

## Por que favorito é user-scoped

O favorito é preferência pessoal do usuário logado sobre um documento que ele já pode acessar. O `userId` é o dono do favorito — não o tenant, não a empresa, não outros usuários.

## Por que não foi salvo no Postgres/auth-service

O auth-service é fonte de verdade para identidade, tenants, memberships e sessões. Documentos e preferências documentais vivem no Mongo do app principal. Favoritos não concedem permissão e não precisam ser conhecidos pelo auth-service.

## Endpoints (app principal)

| Método | Rota | Ação |
|--------|------|------|
| POST | `/api/documents/:documentId/favorite` | Favoritar (idempotente) |
| DELETE | `/api/documents/:documentId/favorite` | Desfavoritar (idempotente) |
| GET | `/api/favorites/documents` | Listar favoritos acessíveis |

Arquivos: `api/documents/[documentId]/favorite.ts`, `api/favorites/documents.ts`

## listDocuments + isFavorite

`listDocuments` monta itens via `buildDocumentListItems`, consulta `user_document_favorites` por `userId` + `documentIds` retornados e aplica `attachFavoriteFlags` → `isFavorite: boolean` em cada item.

## Página Favoritos

Rota existente `/biblioteca/favoritos` carrega via `useFavoriteDocuments` → `GET /api/favorites/documents`. Resolve documentos por tenant técnico salvo no favorito, aplica ACL atual e exclui deletados/arquivados.

## Permissões preservadas

- Favoritar exige `canUserListDocument`
- Favorito não concede acesso
- Listagem de favoritos filtra documentos sem permissão, deletados ou arquivados

## Cache / queries

- `['documents', tenantId, userId, ...]`
- `['favorite-documents', userId]`
- Logout já chama `queryClient.clear()` no `AuthProvider`

## Tracking

Eventos server-side: `document.favorite_added`, `document.favorite_removed`

## Arquivos principais alterados

**Backend:** `server/services/favorites/documentFavoritesService.ts`, `server/services/documentListItems.ts`, `server/services/documentService.ts`, `server/db/constants.ts`, `server/db/types.ts`, `server/db/userDocumentFavoritesIndexes.ts`, `server/db/setupMongo.ts`, `server/dev-server.ts`

**API:** `api/favorites/documents.ts`, `api/documents/[documentId]/favorite.ts`

**Frontend:** `src/features/library/hooks/useFavorites.ts`, `src/features/library/api/favoritesApi.ts`, `src/features/library/hooks/useLibraryView.ts`, `src/features/library/components/FileRow.tsx`, `ExplorerFileQuickActions.tsx`, `ExplorerContextMenu.tsx`, `src/types/document-library.ts`

**Testes:** `tests/document-favorites.test.ts`, `tests/library-search-filters.test.ts`

## Qualidade

| Comando | Resultado |
|---------|-----------|
| `npm test` | 875 testes passando |
| `npx tsc -b` | OK |
| `npm run build` | OK |
| `npm run lint` | 1 erro pré-existente (`partyMetadataHeuristics.ts`) + 2 warnings |
