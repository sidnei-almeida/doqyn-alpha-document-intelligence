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
  it('MongoDocument inclui soft delete, desativação e campos legados de purga', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('lifecycleStatus'));
    assert.ok(types.includes("'deactivated'"));
    assert.ok(types.includes('deletedBy'));
    assert.ok(types.includes('trashExpiresAt'));
    assert.ok(types.includes('deactivatedAt'));
    assert.ok(types.includes('deactivatedBy'));
    assert.ok(types.includes('permanentlyDeletedAt'));
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

  it('listDocuments exclui deletedAt, permanentlyDeletedAt e deactivatedAt', () => {
    const documentService = read('server/services/documentService.ts');
    assert.ok(documentService.includes('permanentlyDeletedAt'));
    assert.ok(documentService.includes('deactivatedAt'));
    assert.ok(documentService.includes('deletedAt: { $in: [null, undefined] }'));
  });

  it('listTrashDocuments filtra deletedAt != null e não desativados', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('TRASH_DOCUMENT_FILTER'));
    assert.ok(service.includes('deletedAt: { $ne: null'));
    assert.ok(service.includes('deactivatedAt: { $in: [null, undefined] }'));
  });

  it('restore limpa campos de lixeira', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('restoreDocumentFromTrash'));
    assert.ok(service.includes("lifecycleStatus: 'active'"));
    assert.ok(service.includes('deletedAt: null'));
  });
});

describe('document trash — desativação em vez de hard delete', () => {
  it('expiração da lixeira desativa sem purge R2', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('deactivateExpiredTrashDocuments'));
    assert.ok(service.includes("lifecycleStatus: 'deactivated'"));
    assert.ok(service.includes("deactivatedReason: 'trash_expired'"));
    assert.ok(service.includes("action: 'document.deactivated'"));
    assert.ok(service.includes('emitTrackingEvent'));
    const deactivateBlock = service.slice(
      service.indexOf('async function deactivateTrashDocument'),
      service.indexOf('export async function deactivateExpiredTrashDocuments'),
    );
    assert.equal(deactivateBlock.includes('purgeAllDocumentVersionStorage'), false);
  });

  it('permanent delete retorna 410 PERMANENT_DELETE_DISABLED', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    const permanent = read('api/documents/[documentId]/permanent.ts');
    const batch = read('api/documents/batch/permanent-delete.ts');
    assert.ok(service.includes('PERMANENT_DELETE_DISABLED'));
    assert.ok(service.includes('410'));
    assert.ok(permanent.includes('410'));
    assert.ok(permanent.includes('PERMANENT_DELETE_DISABLED'));
    assert.ok(batch.includes('410'));
  });

  it('listDeactivatedDocuments e reactivateDocument existem', () => {
    const service = read('server/services/trash/documentTrashService.ts');
    assert.ok(service.includes('listDeactivatedDocuments'));
    assert.ok(service.includes('reactivateDocument'));
    assert.ok(service.includes('DEACTIVATED_DOCUMENT_FILTER'));
    assert.ok(service.includes('assertCanManageDeactivatedDocuments'));
  });
});

describe('document trash — permissões', () => {
  it('canTrash e canUpdate restritos a administradores', () => {
    const access = read('server/tenancy/documentAccess.ts');
    assert.ok(access.includes('const canUpdate = isAdmin'));
    assert.ok(access.includes('const canTrash = isAdmin'));
    assert.ok(access.includes('canContribute'));
    assert.ok(access.includes('assertCanTrashDocument'));
    assert.ok(access.includes('assertCanManageDeactivatedDocuments'));
  });

  it('favoritos excluem documentos com deletedAt', () => {
    const favorites = read('server/services/favorites/documentFavoritesService.ts');
    assert.ok(favorites.includes('deletedAt: { $in: [null, undefined] }'));
    assert.ok(favorites.includes('deactivatedAt'));
  });
});

describe('document trash — tracking', () => {
  it('ações de tracking para lixeira e desativados', () => {
    const audit = read('server/audit/documentAuditTypes.ts');
    assert.ok(audit.includes('document.trash_moved'));
    assert.ok(audit.includes('document.trash_restored'));
    assert.ok(audit.includes('document.deactivated'));
    assert.ok(audit.includes('document.reactivated'));
  });

  it('endpoints emitem tracking events', () => {
    const trashApi = read('api/documents/[documentId]/trash.ts');
    const restoreApi = read('api/documents/[documentId]/restore.ts');
    const reactivateApi = read('api/documents/[documentId]/reactivate.ts');
    assert.ok(trashApi.includes('document.trash_moved'));
    assert.ok(restoreApi.includes('document.trash_restored'));
    assert.ok(reactivateApi.includes('document.reactivated'));
  });
});

describe('document trash — endpoints e apiServer', () => {
  it('expõe rotas de lixeira e desativados no apiServer', () => {
    const apiServer = read('server/apiServer.ts');
    assert.ok(apiServer.includes('/api/trash/documents'));
    assert.ok(apiServer.includes('/api/deactivated/documents'));
    assert.ok(apiServer.includes('/api/documents/batch/trash'));
    assert.ok(apiServer.includes('/api/documents/batch/restore'));
    assert.ok(apiServer.includes('/api/documents/batch/reactivate'));
    assert.ok(apiServer.includes('/api/documents/batch/permanent-delete'));
    assert.ok(apiServer.includes('/reactivate'));
    assert.ok(apiServer.includes('/restore'));
    assert.ok(apiServer.includes('/permanent'));
  });

  it('GET /api/trash/documents lista lixeira', () => {
    const api = read('api/trash/documents.ts');
    assert.ok(api.includes('listTrashDocuments'));
  });

  it('GET /api/deactivated/documents lista desativados', () => {
    const api = read('api/deactivated/documents.ts');
    assert.ok(api.includes('listDeactivatedDocuments'));
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

  it('script trash:purge-expired desativa documentos expirados', () => {
    const pkg = read('package.json');
    const script = read('scripts/trash-purge-expired.ts');
    assert.ok(pkg.includes('trash:purge-expired'));
    assert.ok(script.includes('deactivateExpiredTrashDocuments'));
    assert.ok(script.includes('--apply'));
  });
});

describe('document trash — frontend lixeira e desativados', () => {
  it('useTrashDocuments consome GET /api/trash/documents', () => {
    const hook = read('src/features/library/hooks/useTrashDocuments.ts');
    const api = read('src/features/library/api/trashApi.ts');
    assert.ok(hook.includes("queryKey: ['trash-documents'"));
    assert.ok(api.includes('/api/trash/documents'));
  });

  it('useDeactivatedDocuments consome GET /api/deactivated/documents', () => {
    const hook = read('src/features/library/hooks/useDeactivatedDocuments.ts');
    const api = read('src/features/library/api/deactivatedApi.ts');
    assert.ok(hook.includes("queryKey: ['deactivated-documents'"));
    assert.ok(api.includes('/api/deactivated/documents'));
  });

  it('useLibraryView usa trash e deactivated APIs nas coleções', () => {
    const hook = read('src/features/library/hooks/useLibraryView.ts');
    assert.ok(hook.includes("collection.id === 'lixeira'"));
    assert.ok(hook.includes("collection.id === 'desativados'"));
    assert.ok(hook.includes('useTrashDocuments'));
    assert.ok(hook.includes('useDeactivatedDocuments'));
  });

  it('BulkSelectionToolbar desabilita Excluir com pastas selecionadas', () => {
    const toolbar = read('src/features/library/components/BulkSelectionToolbar.tsx');
    assert.ok(toolbar.includes('selectedFolderCount'));
    assert.ok(toolbar.includes('hasFolderSelection'));
    assert.ok(toolbar.includes('Pastas e categorias não podem ser excluídas'));
    assert.ok(toolbar.includes('isTrashView'));
  });

  it('lixeira mostra Restaurar; desativados mostra Recuperar; sem exclusão permanente', () => {
    const toolbar = read('src/features/library/components/BulkSelectionToolbar.tsx');
    assert.ok(toolbar.includes('Restaurar'));
    assert.ok(toolbar.includes('Recuperar'));
    assert.ok(toolbar.includes('onReactivate'));
    assert.equal(toolbar.includes('Excluir permanentemente'), false);
    assert.equal(toolbar.includes('onPermanentDelete'), false);
  });

  it('LibraryPage usa confirmação para trash e reativação', () => {
    const page = read('src/features/library/LibraryPage.tsx');
    assert.ok(page.includes('buildMoveToTrashConfirm'));
    assert.ok(page.includes('useTrashMutations'));
    assert.ok(page.includes('useDeactivatedMutations'));
    assert.ok(page.includes('handleReactivate'));
    assert.equal(page.includes('buildPermanentDeleteConfirm'), false);
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
    assert.ok(menu.includes('isDeactivatedView'));
    assert.ok(menu.includes('onTrashFile'));
    assert.ok(menu.includes('onReactivateFile'));
    assert.equal(menu.includes('Excluir permanentemente'), false);
  });

  it('settings tem retenção na aba Empresa com copy de desativação', () => {
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
    assert.ok(retention.includes('desativado'));
    assert.ok(retention.includes('isDirty'));
    assert.ok(retention.includes('RETENTION_DAYS_MIN'));
  });

  it('confirmMessages não inclui permanent delete', () => {
    const messages = read('src/components/confirm/confirmMessages.ts');
    assert.ok(messages.includes('buildMoveToTrashConfirm'));
    assert.ok(messages.includes('desativado'));
    assert.equal(messages.includes('buildPermanentDeleteConfirm'), false);
  });

  it('tracking display traduz eventos de lixeira e desativados', () => {
    const display = read('src/features/tracking/utils/trackingDisplay.ts');
    assert.ok(display.includes('document.trash_moved'));
    assert.ok(display.includes('document.reactivated'));
    assert.ok(display.includes('document.deactivated'));
  });

  it('collections inclui desativados e lixeira sem filtro archived', () => {
    const collections = read('src/features/library/collections.ts');
    assert.ok(collections.includes("'desativados'"));
    assert.ok(collections.includes("slug: 'desativados'"));
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

  it('trashApi e deactivatedApi expõem restore/reactivate', () => {
    const api = read('src/features/library/api/trashApi.ts');
    const deactivated = read('src/features/library/api/deactivatedApi.ts');
    assert.ok(api.includes('batchRestoreDocuments'));
    assert.equal(api.includes('batchPermanentlyDeleteDocuments'), false);
    assert.ok(deactivated.includes('batchReactivateDocuments'));
    assert.ok(deactivated.includes('/api/documents/batch/reactivate'));
  });

  it('invalidação de cache após mutações de lixeira', () => {
    const mutations = read('src/features/library/hooks/useTrashMutations.ts');
    assert.ok(mutations.includes('invalidateLibraryQueries'));
    assert.ok(mutations.includes("['trash-documents']"));
  });

  it('sidebar filtra Desativados para admin+', () => {
    const sidebar = read('src/components/layout/Sidebar.tsx');
    const constants = read('src/lib/constants.ts');
    assert.ok(constants.includes("path: '/biblioteca/desativados'"));
    assert.ok(constants.includes('adminOnly: true'));
    assert.ok(sidebar.includes('canManageDeactivated'));
    assert.ok(sidebar.includes('libraryViewItems'));
  });
});
