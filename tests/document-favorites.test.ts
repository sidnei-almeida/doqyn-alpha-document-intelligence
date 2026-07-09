import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('document favorites — persistência user-scoped no Mongo', () => {
  it('define coleção global user_document_favorites com índices por userId', () => {
    const constants = read('server/db/constants.ts');
    const indexes = read('server/db/userDocumentFavoritesIndexes.ts');
    const types = read('server/db/types.ts');

    assert.ok(constants.includes("userDocumentFavorites: 'user_document_favorites'"));
    assert.ok(indexes.includes('userId: 1, documentId: 1'));
    assert.ok(indexes.includes('userId: 1, deletedAt: 1, createdAt: -1'));
    assert.ok(types.includes('MongoUserDocumentFavorite'));
    assert.ok(types.includes('userId: string'));
  });

  it('service valida acesso antes de favoritar e não usa Postgres/auth-service', () => {
    const service = read('server/services/favorites/documentFavoritesService.ts');

    assert.ok(service.includes('canUserListDocument'));
    assert.ok(service.includes('SHARED_APP_COLLECTIONS.userDocumentFavorites'));
    assert.ok(service.includes('addDocumentFavorite'));
    assert.ok(service.includes('removeDocumentFavorite'));
    assert.ok(service.includes('listFavoriteDocuments'));
    assert.equal(service.includes('prisma'), false);
    assert.equal(service.includes('auth-service'), false);
  });

  it('listDocuments enriquece itens com isFavorite por userId', () => {
    const documentService = read('server/services/documentService.ts');

    assert.ok(documentService.includes('lookupFavoriteFlags'));
    assert.ok(documentService.includes('attachFavoriteFlags'));
  });

  it('expõe endpoints no app principal (não auth-service)', () => {
    const favoriteApi = read('api/documents/[documentId]/favorite.ts');
    const listApi = read('api/favorites/documents.ts');
    const devServer = read('server/dev-server.ts');

    assert.ok(favoriteApi.includes('addDocumentFavorite'));
    assert.ok(favoriteApi.includes('removeDocumentFavorite'));
    assert.ok(favoriteApi.includes('document.favorite_added'));
    assert.ok(listApi.includes('listFavoriteDocuments'));
    assert.ok(devServer.includes('/api/favorites/documents'));
    assert.ok(devServer.includes('/favorite'));
  });
});

describe('document favorites — frontend', () => {
  it('useFavorites usa API Mongo e query keys com userId', () => {
    const hook = read('src/features/library/hooks/useFavorites.ts');
    const api = read('src/features/library/api/favoritesApi.ts');
    const useDocuments = read('src/features/documents/hooks/useDocuments.ts');

    assert.equal(hook.includes('localStorage'), false);
    assert.ok(hook.includes("queryKey: ['favorite-documents', userId]"));
    assert.ok(hook.includes('favoriteDocument'));
    assert.ok(hook.includes('unfavoriteDocument'));
    assert.ok(api.includes('/api/favorites/documents'));
    assert.ok(useDocuments.includes("['documents', tenantId, userId"));
  });

  it('Biblioteca mostra estrela e menu de favoritos', () => {
    const fileRow = read('src/features/library/components/FileRow.tsx');
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    const quickActions = read('src/features/library/components/ExplorerFileQuickActions.tsx');
    const libraryView = read('src/features/library/hooks/useLibraryView.ts');

    assert.ok(fileRow.includes('star'));
    assert.ok(fileRow.includes('stopPropagation'));
    assert.ok(menu.includes('Adicionar aos favoritos'));
    assert.ok(menu.includes('Remover dos favoritos'));
    assert.ok(quickActions.includes('toggleStar'));
    assert.ok(libraryView.includes('useFavoriteDocuments'));
    assert.ok(libraryView.includes("collection.id === 'favoritos'"));
  });
});
