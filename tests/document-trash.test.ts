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

describe('document trash — tipos e campos Mongo', () => {
  it('MongoDocument inclui campos de soft delete e purga', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('lifecycleStatus'));
    assert.ok(types.includes('deletedBy'));
    assert.ok(types.includes('trashExpiresAt'));
    assert.ok(types.includes('permanentlyDeletedAt'));
    assert.ok(types.includes('purgeStatus'));
  });

  it('MongoTenant inclui settings.trash com retenção', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoTenantTrashSettings'));
    assert.ok(types.includes('trashRetentionMode'));
    assert.ok(types.includes('trashRetentionDays'));
  });
});

describe('document trash — retenção por tenant', () => {
  it('normaliza dias entre 1 e 365', () => {
    const settings = read('server/services/trash/trashRetentionSettings.ts');
    assert.ok(settings.includes('MIN_TRASH_RETENTION_DAYS'));
    assert.ok(settings.includes('MAX_TRASH_RETENTION_DAYS'));
    assert.ok(settings.includes('DEFAULT_TRASH_RETENTION_DAYS'));
    assert.ok(settings.includes('computeTrashExpiresAt'));
  });

  it('modo manual não define trashExpiresAt', () => {
    const settings = read('server/services/trash/trashRetentionSettings.ts');
    assert.ok(settings.includes("trashRetentionMode === 'manual'"));
  });

  it('persiste em tenants.settings.trash', () => {
    const settings = read('server/services/trash/trashRetentionSettings.ts');
    assert.ok(settings.includes("'settings.trash'"));
    assert.ok(settings.includes('REGISTRY_COLLECTIONS.tenants'));
  });
});

describe('document trash — soft delete service', () => {
  it('moveDocumentToTrash define deletedAt e lifecycleStatus trashed', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('moveDocumentToTrash'));
    assert.ok(service.includes("lifecycleStatus: 'trashed'"));
    assert.ok(service.includes('deletedAt: now'));
    assert.ok(service.includes('trashExpiresAt'));
  });

  it('soft delete não chama purge de storage', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    const moveBlock = service.slice(
      service.indexOf('export async function moveDocumentToTrash'),
      service.indexOf('export async function restoreDocumentFromTrash'),
    );
    assert.equal(moveBlock.includes('purgeAllDocumentVersionStorage'), false);
    assert.equal(moveBlock.includes('deleteDocumentVersion'), false);
  });

  it('listDocuments exclui deletedAt e permanentlyDeletedAt', () => {
    const documentService = read('server/services/documentService.ts');
    assert.ok(documentService.includes('permanentlyDeletedAt'));
    assert.ok(documentService.includes('deletedAt: { $in: [null, undefined] }'));
  });

  it('listTrashDocuments filtra deletedAt != null e não purgados', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('TRASH_DOCUMENT_FILTER'));
    assert.ok(service.includes('deletedAt: { $ne: null'));
    assert.ok(service.includes('permanentlyDeletedAt'));
  });

  it('restore limpa campos de lixeira', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('restoreDocumentFromTrash'));
    assert.ok(service.includes("lifecycleStatus: 'active'"));
    assert.ok(service.includes('deletedAt: null'));
  });
});

describe('document trash — permanent delete e R2', () => {
  it('purge remove original, preview e assets do manifest', () => {
    const purge = read('server/services/trash/documentStoragePurgeService.ts');
    assert.ok(purge.includes('purgeDocumentVersionStorage'));
    assert.ok(purge.includes('deleteDocumentVersion'));
    assert.ok(purge.includes('previewObjectKey'));
    assert.ok(purge.includes('thumbnailObjectKey'));
  });

  it('permanent delete marca permanentlyDeletedAt e purgeStatus', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('permanentlyDeletedAt'));
    assert.ok(service.includes('purgeStatus'));
    assert.ok(service.includes("'permanently_deleted'"));
  });

  it('falha parcial R2 mantém purgeStatus failed', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes("purge.hasFailures ? ('failed'"));
    assert.ok(service.includes("lifecycleStatus: purge.hasFailures ? 'trashed'"));
  });

  it('não remove audit/tracking — apenas storage R2', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    const purgeFn = service.slice(
      service.indexOf('async function executePermanentDocumentPurge'),
      service.indexOf('type BatchResult'),
    );
    assert.equal(purgeFn.includes('auditLogs'), false);
    assert.equal(purgeFn.includes('documentVersions.delete'), false);
  });
});

describe('document trash — permissões', () => {
  it('canTrash e canUpdate restritos a administradores', () => {
    const access = read('server/tenancy/documentAccess.ts');
    assert.ok(access.includes('const canUpdate = isAdmin'));
    assert.ok(access.includes('const canTrash = isAdmin'));
    assert.ok(access.includes('canContribute'));
    assert.ok(access.includes('assertCanTrashDocument'));
    assert.ok(access.includes('assertCanPermanentDeleteDocument'));
  });

  it('favoritos excluem documentos com deletedAt', () => {
    const favorites = read('server/services/favorites/documentFavoritesService.ts');
    assert.ok(favorites.includes('deletedAt: { $in: [null, undefined] }'));
  });
});

describe('document trash — tracking', () => {
  it('ações de tracking para lixeira', () => {
    const audit = read('server/audit/documentAuditTypes.ts');
    assert.ok(audit.includes('document.trash_moved'));
    assert.ok(audit.includes('document.trash_restored'));
    assert.ok(audit.includes('document.permanent_deleted'));
    assert.ok(audit.includes('document.trash_purge_failed'));
  });

  it('endpoints emitem tracking events', () => {
    const trashApi = read('api/documents/[documentId]/trash.ts');
    const restoreApi = read('api/documents/[documentId]/restore.ts');
    const permanentApi = read('api/documents/[documentId]/permanent.ts');
    assert.ok(trashApi.includes('document.trash_moved'));
    assert.ok(restoreApi.includes('document.trash_restored'));
    assert.ok(permanentApi.includes('document.permanent_deleted'));
  });
});

describe('document trash — endpoints e dev-server', () => {
  it('expõe rotas de lixeira no app principal', () => {
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('/api/trash/documents'));
    assert.ok(devServer.includes('/api/documents/batch/trash'));
    assert.ok(devServer.includes('/api/documents/batch/restore'));
    assert.ok(devServer.includes('/api/documents/batch/permanent-delete'));
    assert.ok(devServer.includes('/trash'));
    assert.ok(devServer.includes('/restore'));
    assert.ok(devServer.includes('/permanent'));
  });

  it('GET /api/trash/documents lista lixeira', () => {
    const api = read('api/trash/documents.ts');
    assert.ok(api.includes('listTrashDocuments'));
  });

  it('batch trash aceita documentIds', () => {
    const api = read('api/documents/batch/trash.ts');
    assert.ok(api.includes('batchMoveDocumentsToTrash'));
    assert.ok(api.includes('documentIds'));
  });

  it('settings trash-retention por tenant', () => {
    const api = read('api/settings/trash-retention.ts');
    assert.ok(api.includes('getTrashRetentionSettings'));
    assert.ok(api.includes('updateTrashRetentionSettings'));
    assert.ok(api.includes('isDocumentAdmin'));
  });

  it('script trash:purge-expired com dry-run default', () => {
    const pkg = read('package.json');
    const script = read('scripts/trash-purge-expired.ts');
    assert.ok(pkg.includes('trash:purge-expired'));
    assert.ok(script.includes('purgeExpiredTrashDocuments'));
    assert.ok(script.includes('--apply'));
  });
});

describe('document trash — frontend lixeira', () => {
  it('useTrashDocuments consome GET /api/trash/documents', () => {
    const hook = read('src/features/library/hooks/useTrashDocuments.ts');
    const api = read('src/features/library/api/trashApi.ts');
    assert.ok(hook.includes("queryKey: ['trash-documents'"));
    assert.ok(api.includes('/api/trash/documents'));
  });

  it('useLibraryView usa trash API na coleção lixeira', () => {
    const hook = read('src/features/library/hooks/useLibraryView.ts');
    assert.ok(hook.includes("collection.id === 'lixeira'"));
    assert.ok(hook.includes('useTrashDocuments'));
    assert.ok(hook.includes('!isTrashCollection'));
  });

  it('BulkSelectionToolbar desabilita Excluir com pastas selecionadas', () => {
    const toolbar = read('src/features/library/components/BulkSelectionToolbar.tsx');
    assert.ok(toolbar.includes('selectedFolderCount'));
    assert.ok(toolbar.includes('hasFolderSelection'));
    assert.ok(toolbar.includes('Pastas e categorias não podem ser excluídas'));
    assert.ok(toolbar.includes('isTrashView'));
  });

  it('lixeira mostra Restaurar e Excluir permanentemente', () => {
    const toolbar = read('src/features/library/components/BulkSelectionToolbar.tsx');
    assert.ok(toolbar.includes('Restaurar'));
    assert.ok(toolbar.includes('Excluir permanentemente'));
    assert.ok(toolbar.includes('onPermanentDelete'));
  });

  it('LibraryPage usa confirmação para trash e permanent delete', () => {
    const page = read('src/features/library/LibraryPage.tsx');
    assert.ok(page.includes('buildMoveToTrashConfirm'));
    assert.ok(page.includes('buildPermanentDeleteConfirm'));
    assert.ok(page.includes('useTrashMutations'));
  });

  it('menu de contexto de pasta não tem Excluir ativo', () => {
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    const folderBlock = menu.slice(
      menu.indexOf("{state.kind === 'folder' && ("),
      menu.indexOf("{state.kind === 'file' && ("),
    );
    assert.ok(folderBlock.includes('Arquivar categoria'));
    assert.equal(folderBlock.includes('Mover para lixeira'), false);
  });

  it('menu de arquivo tem Mover para lixeira fora da lixeira', () => {
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('Mover para lixeira'));
    assert.ok(menu.includes('isTrashView'));
    assert.ok(menu.includes('onTrashFile'));
  });

  it('settings tem retenção na aba Empresa', () => {
    const sections = read('src/features/settings/settingsSections.ts');
    const page = read('src/features/settings/SettingsPage.tsx');
    const company = read('src/features/settings/components/sections/CompanySettingsSection.tsx');
    const retention = read(
      'src/features/settings/components/sections/TrashRetentionSettingsSection.tsx',
    );
    assert.ok(sections.includes("'empresa'"));
    assert.ok(sections.includes("'retencao'"));
    assert.ok(sections.includes("lixeira: { section: 'empresa', tab: 'retencao' }"));
    assert.ok(page.includes('CompanySettingsSection'));
    assert.ok(company.includes('TrashRetentionSettingsSection'));
    assert.ok(company.includes('canManageRetention'));
    assert.ok(retention.includes('settings-retention-preview'));
    assert.ok(retention.includes('isDirty'));
    assert.ok(retention.includes('muted={!daysEnabled}'));
    assert.ok(retention.includes('RETENTION_DAYS_MIN'));
    assert.ok(retention.includes('RETENTION_DAYS_MAX'));
  });

  it('confirmMessages inclui permanent delete com EXCLUIR', () => {
    const messages = read('src/components/confirm/confirmMessages.ts');
    assert.ok(messages.includes('buildPermanentDeleteConfirm'));
    assert.ok(messages.includes('CONFIRM_DELETE_WORD'));
  });

  it('tracking display traduz eventos de lixeira', () => {
    const display = read('src/features/tracking/utils/trackingDisplay.ts');
    assert.ok(display.includes('document.trash_moved'));
    assert.ok(display.includes('document.permanent_deleted'));
  });

  it('collections lixeira não filtra por status archived', () => {
    const collections = read('src/features/library/collections.ts');
    const lixeiraBlock = collections.slice(
      collections.indexOf("case 'lixeira'"),
      collections.indexOf('default:'),
    );
    assert.equal(lixeiraBlock.includes("status === 'archived'"), false);
  });

  it('libraryFilterUtils não usa status archived para lixeira', () => {
    const filters = read('src/features/library/utils/libraryFilterUtils.ts');
    assert.equal(filters.includes("filters.status = 'archived'"), false);
  });

  it('trashApi expõe batch restore e permanent delete', () => {
    const api = read('src/features/library/api/trashApi.ts');
    assert.ok(api.includes('batchRestoreDocuments'));
    assert.ok(api.includes('batchPermanentlyDeleteDocuments'));
    assert.ok(api.includes('/api/documents/batch/permanent-delete'));
  });

  it('invalidação de cache após mutações de lixeira', () => {
    const mutations = read('src/features/library/hooks/useTrashMutations.ts');
    assert.ok(mutations.includes('invalidateLibraryQueries'));
    assert.ok(mutations.includes("['trash-documents']"));
  });
});
