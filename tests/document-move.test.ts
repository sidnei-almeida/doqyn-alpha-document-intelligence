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

describe('document move — modelo e serviço', () => {
  it('MongoDocument inclui campos de movimentação manual', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('previousClassId'));
    assert.ok(types.includes('lastClassificationSource'));
    assert.ok(types.includes('manualClassificationOverride'));
    assert.ok(types.includes('movedAt'));
    assert.ok(types.includes('movedBy'));
    assert.ok(types.includes('aiSuggestedClassId'));
  });

  it('moveDocumentToCategory atualiza classId sem criar versão', () => {
    const service = read('server/services/documentMoveService.ts');
    assert.ok(service.includes('moveDocumentToCategory'));
    assert.ok(service.includes('classId: targetCategory._id'));
    assert.ok(service.includes('classification.classId'));
    assert.equal(service.includes('versionNumber'), false);
    assert.equal(service.includes('insertOne'), false);
    assert.equal(service.includes('purgeAllDocumentVersionStorage'), false);
    assert.equal(service.includes('copyObject'), false);
    assert.equal(service.includes('deleteObject'), false);
  });

  it('move preserva documentId e currentVersionId', () => {
    const service = read('server/services/documentMoveService.ts');
    assert.ok(service.includes('currentVersionId: doc.currentVersionId'));
    assert.equal(service.includes('nanoid'), false);
  });

  it('move rejeita documento na lixeira', () => {
    const service = read('server/services/documentMoveService.ts');
    assert.ok(service.includes('DOCUMENT_TRASHED'));
    assert.ok(service.includes('deletedAt'));
  });

  it('move exige permissão canUpdate', () => {
    const service = read('server/services/documentMoveService.ts');
    assert.ok(service.includes('assertCanUpdateDocument'));
  });

  it('move atualiza categoryId dos chunks sem reprocessar OCR', () => {
    const chunks = read('server/services/documentChunkService.ts');
    assert.ok(chunks.includes('updateDocumentChunksCategory'));
    const updateBlock = chunks.slice(
      chunks.indexOf('export async function updateDocumentChunksCategory'),
      chunks.indexOf('export async function queryDocumentChunksForRag'),
    );
    assert.ok(updateBlock.includes('$set: { categoryId'));
    assert.equal(updateBlock.includes('extractTextFromPdf'), false);
  });

  it('batch move usa runBatch seguro', () => {
    const service = read('server/services/documentMoveService.ts');
    assert.ok(service.includes('batchMoveDocumentsToCategory'));
    assert.ok(service.includes('skipped'));
    assert.ok(service.includes('failed'));
  });
});

describe('document move — API', () => {
  it('POST /api/documents/:documentId/move', () => {
    const api = read('api/documents/[documentId]/move.ts');
    assert.ok(api.includes('moveDocumentToCategory'));
    assert.ok(api.includes('targetClassId'));
    assert.ok(api.includes("action: 'document.moved'"));
  });

  it('POST /api/documents/batch/move', () => {
    const api = read('api/documents/batch/move.ts');
    assert.ok(api.includes('batchMoveDocumentsToCategory'));
    assert.ok(api.includes('documentIds'));
  });

  it('dev-server registra rotas de move', () => {
    const dev = read('server/dev-server.ts');
    assert.ok(dev.includes('/api/documents/batch/move'));
    assert.ok(dev.includes('/move'));
  });
});

describe('document move — tracking', () => {
  it('document.moved está nos tipos de auditoria', () => {
    const audit = read('server/audit/documentAuditTypes.ts');
    assert.ok(audit.includes("'document.moved'"));
  });

  it('tracking display inclui document.moved', () => {
    const display = read('src/features/tracking/utils/trackingDisplay.ts');
    assert.ok(display.includes("'document.moved'"));
  });
});

describe('document move — frontend', () => {
  it('MoveDocumentModal lista categorias e confirma destino', () => {
    const modal = read('src/features/library/components/MoveDocumentModal.tsx');
    assert.ok(modal.includes('move-document-modal'));
    assert.ok(modal.includes('Categoria atual'));
    assert.ok(modal.includes('Mover para'));
    assert.ok(modal.includes('Buscar categoria'));
  });

  it('moveApi chama endpoints corretos', () => {
    const api = read('src/features/library/api/moveApi.ts');
    assert.ok(api.includes('/api/documents/${encoded}/move'));
    assert.ok(api.includes('/api/documents/batch/move'));
    assert.ok(api.includes('targetClassId'));
  });

  it('context menu habilita Mover para documento com permissão', () => {
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('onMoveFile'));
    assert.ok(menu.includes('canMove'));
    assert.doesNotMatch(menu, /onComingSoon\('Mover'\)/);
  });

  it('toolbar desabilita Mover com pasta selecionada', () => {
    const toolbar = read('src/features/library/components/BulkSelectionToolbar.tsx');
    assert.ok(toolbar.includes('drive_file_move'));
    assert.ok(toolbar.includes('Selecione apenas documentos para mover'));
    assert.ok(toolbar.includes('hasFolderSelection'));
  });

  it('LibraryPage integra modal e mutação', () => {
    const page = read('src/features/library/LibraryPage.tsx');
    assert.ok(page.includes('MoveDocumentModal'));
    assert.ok(page.includes('useMoveDocumentMutations'));
    assert.ok(page.includes('handleMoveSingle'));
    assert.ok(page.includes('handleBulkMove'));
  });

  it('invalidação inclui document-detail', () => {
    const hooks = read('src/features/library/hooks/useMoveDocumentMutations.ts');
    assert.ok(hooks.includes("queryKey: ['document-detail']"));
    assert.ok(hooks.includes('invalidateLibraryQueries'));
  });

  it('menu de pasta não inclui Mover documento', () => {
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    const folderBlock = menu.slice(menu.indexOf("state.kind === 'folder'"), menu.indexOf("state.kind === 'file'"));
    assert.equal(folderBlock.includes('Mover'), false);
  });
});

describe('document move — listDocuments', () => {
  it('filtro por categoryId usa classId no Mongo', () => {
    const service = read('server/services/documentService.ts');
    assert.ok(service.includes('query.classId = filters.categoryId'));
  });
});
