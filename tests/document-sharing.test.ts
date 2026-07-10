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

describe('document sharing — modelo Mongo', () => {
  it('document_share_grants em SHARED_APP_COLLECTIONS', () => {
    const constants = read('server/db/constants.ts');
    assert.ok(constants.includes("documentShareGrants: 'document_share_grants'"));
  });

  it('MongoDocumentShareGrant inclui permissions e status', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoDocumentShareGrant'));
    assert.ok(types.includes('sharedWithUserId'));
    assert.ok(types.includes("status: DocumentShareGrantStatus"));
  });

  it('índices únicos parciais para share ativo', () => {
    const indexes = read('server/db/documentShareGrantsIndexes.ts');
    assert.ok(indexes.includes('documentId_sharedWithUserId_active_unique'));
    assert.ok(indexes.includes("partialFilterExpression: { status: 'active' }"));
  });
});

describe('document sharing — serviço e segurança', () => {
  it('share persiste no Mongo sem alterar R2', () => {
    const service = read('server/services/sharing/documentShareService.ts');
    assert.ok(service.includes('SHARED_APP_COLLECTIONS.documentShareGrants'));
    assert.equal(service.includes('copyObject'), false);
    assert.equal(service.includes('deleteObject'), false);
    assert.equal(service.includes('insertOne'), true);
  });

  it('não compartilha consigo mesmo nem documento na lixeira', () => {
    const service = read('server/services/sharing/documentShareService.ts');
    assert.ok(service.includes('SELF_SHARE_DENIED'));
    assert.ok(service.includes('DOCUMENT_TRASHED'));
  });

  it('valida destinatário ativo no tenant via tenant_members', () => {
    const service = read('server/services/sharing/documentShareService.ts');
    assert.ok(service.includes('listOperationalTenantMembers'));
    assert.ok(service.includes('REGISTRY_COLLECTIONS.tenantMembers'));
    assert.ok(service.includes("status: 'active'"));
  });

  it('ACL considera share grant ativo', () => {
    const access = read('server/tenancy/documentShareAccess.ts');
    assert.ok(access.includes('resolveDocumentPermissionsWithShare'));
    assert.ok(access.includes('canUserListDocumentWithShare'));
    assert.ok(access.includes('canUserShareDocument'));
  });

  it('revogar share não remove acesso base por grupo', () => {
    const access = read('server/tenancy/documentShareAccess.ts');
    assert.ok(access.includes('canUserListDocument(user, doc, memberGroupIds)'));
  });
});

describe('document sharing — API', () => {
  it('endpoints de shares e shared-with-me', () => {
    const shares = read('api/documents/[documentId]/shares.ts');
    const revoke = read('api/documents/[documentId]/shares/[shareId].ts');
    const shared = read('api/shared-with-me/documents.ts');
    const users = read('api/share/users.ts');
    assert.ok(shares.includes('createDocumentShareGrant'));
    assert.ok(revoke.includes('revokeDocumentShareGrant'));
    assert.ok(shared.includes('listSharedWithMeDocuments'));
    assert.ok(users.includes('searchShareableTenantUsers'));
  });

  it('tracking registra share_created e share_revoked', () => {
    const shares = read('api/documents/[documentId]/shares.ts');
    const revoke = read('api/documents/[documentId]/shares/[shareId].ts');
    assert.ok(shares.includes("action: 'document.share_created'"));
    assert.ok(revoke.includes("action: 'document.share_revoked'"));
  });

  it('dev-server registra rotas', () => {
    const dev = read('server/dev-server.ts');
    assert.ok(dev.includes('/api/shared-with-me/documents'));
    assert.ok(dev.includes('/api/share/users'));
    assert.ok(dev.includes('/shares'));
  });
});

describe('document sharing — frontend', () => {
  it('ShareDocumentModal busca usuários e lista acessos', () => {
    const modal = read('src/features/sharing/components/ShareDocumentModal.tsx');
    assert.ok(modal.includes('share-document-modal'));
    assert.ok(modal.includes('Buscar usuário'));
    assert.ok(modal.includes('Pessoas com acesso compartilhado'));
    assert.ok(modal.includes('Permitir download'));
  });

  it('Compartilhados comigo usa API dedicada', () => {
    const hook = read('src/features/sharing/hooks/useSharedWithMeDocuments.ts');
    const view = read('src/features/library/hooks/useLibraryView.ts');
    assert.ok(hook.includes('fetchSharedWithMeDocuments'));
    assert.ok(view.includes('useSharedWithMeDocuments'));
    assert.ok(view.includes("collection.id === 'compartilhados'"));
  });

  it('context menu habilita Compartilhar com canShare', () => {
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('onShareFile'));
    assert.ok(menu.includes('canShare'));
    assert.doesNotMatch(menu, /onComingSoon\('Compartilhar'\)/);
  });

  it('LibraryPage integra ShareDocumentModal', () => {
    const page = read('src/features/library/LibraryPage.tsx');
    assert.ok(page.includes('ShareDocumentModal'));
    assert.ok(page.includes('handleShareSingle'));
  });

  it('favoritos consideram share grant', () => {
    const favorites = read('server/services/favorites/documentFavoritesService.ts');
    assert.ok(favorites.includes('canUserListDocumentWithShare'));
    assert.ok(favorites.includes('findActiveShareGrantsForUser'));
  });
});
