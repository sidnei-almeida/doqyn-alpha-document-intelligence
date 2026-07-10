import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('fluxo dedicado de atualização de versão', () => {
  it('LibraryPage abre drawer dedicado em vez de /upload?documentId', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('UpdateDocumentVersionDrawer'));
    assert.ok(page.includes('openUpdateVersionDrawer'));
    assert.equal(page.includes('/upload?documentId='), false);
  });

  it('DocumentViewerModal redireciona para biblioteca?updateVersion quando sem callback', () => {
    const modal = readSrc('features/documents/viewer/DocumentViewerModal.tsx');
    assert.ok(modal.includes('onUpdateDocument'));
    assert.ok(modal.includes('/biblioteca?updateVersion='));
    assert.equal(modal.includes('/upload?documentId='), false);
  });

  it('DocumentSendPage redireciona update legado para biblioteca', () => {
    const send = readSrc('features/document-send/DocumentSendPage.tsx');
    assert.ok(send.includes('/biblioteca?updateVersion='));
    assert.ok(send.includes('replace: true'));
  });

  it('drawer dedicado exibe resumo, metadados e histórico', () => {
    const drawer = readSrc('features/document-update-version/UpdateDocumentVersionDrawer.tsx');
    const shell = readSrc('components/layout/WorkspaceSideDrawer.tsx');
    assert.ok(drawer.includes('CurrentDocumentSummaryCard'));
    assert.ok(drawer.includes('CurrentMetadataPanel'));
    assert.ok(drawer.includes('VersionHistorySummary'));
    assert.ok(drawer.includes('NewVersionAnalyzingPanel'));
    assert.ok(shell.includes('max-w-xl'));
    assert.ok(drawer.includes('WorkspaceSideDrawer'));
    assert.ok(drawer.includes('fillHeight'));
    assert.ok(drawer.includes('testId="update-version-drawer"'));
  });

  it('preview do documento atual usa proporção de página', () => {
    const summary = readSrc(
      'features/document-update-version/components/CurrentDocumentSummaryCard.tsx',
    );
    assert.ok(summary.includes('aspect-[3/4]'));
    assert.ok(summary.includes('object-contain'));
  });

  it('dropzone usa ícone upload padronizado do app', () => {
    const dropzone = readSrc('features/document-update-version/components/NewVersionUploadDropzone.tsx');
    assert.ok(dropzone.includes('name="upload"'));
    assert.equal(dropzone.includes('upload_file'), false);
  });

  it('upload inicia análise automaticamente sem botão Analisar', () => {
    const drawer = readSrc('features/document-update-version/UpdateDocumentVersionDrawer.tsx');
    assert.ok(drawer.includes('void runAnalysis(file)'));
    assert.equal(drawer.includes('file_selected'), false);

    const actions = readSrc('features/document-update-version/components/ConfirmNewVersionActions.tsx');
    assert.equal(actions.includes('Analisar nova versão'), false);
    assert.equal(actions.includes('update-version-analyze-button'), false);
  });

  it('upload chama analyzePdf com documentId para analyze-pdf-update', () => {
    const drawer = readSrc('features/document-update-version/UpdateDocumentVersionDrawer.tsx');
    assert.ok(drawer.includes('analyzePdf'));
    assert.ok(drawer.includes('documentId,'));
    assert.ok(drawer.includes('itemId: documentId'));
    assert.equal(drawer.includes('confirmAnalysis'), false);
  });

  it('revisão compara versão atual com próxima major', () => {
    const review = readSrc('features/document-update-version/components/NewVersionReviewStep.tsx');
    const comparison = readSrc('features/document-update-version/components/VersionComparisonPanel.tsx');
    assert.ok(review.includes('currentVersionLabel'));
    assert.ok(review.includes('nextVersionLabel'));
    assert.ok(review.includes('break-all'));
    assert.ok(comparison.includes('break-all'));
  });

  it('botão de confirmação usa texto Confirmar vX.X', () => {
    const actions = readSrc('features/document-update-version/components/ConfirmNewVersionActions.tsx');
    assert.ok(actions.includes('Confirmar {nextVersionLabel}'));
    assert.equal(actions.includes('Enviar documento'), false);
  });

  it('sucesso invalida listas, detalhe, versões e preview', () => {
    const invalidation = readSrc(
      'features/document-update-version/utils/invalidateDocumentUpdateQueries.ts',
    );
    assert.ok(invalidation.includes("queryKey: ['document-detail'"));
    assert.ok(invalidation.includes("queryKey: ['document-versions'"));
    assert.ok(invalidation.includes("queryKey: ['document-preview-manifest'"));
    assert.ok(invalidation.includes("queryKey: ['favorite-documents'"));
    assert.ok(invalidation.includes("queryKey: ['dashboard-overview'"));
  });

  it('confirm usa endpoint confirm-update e não confirmAnalysis inicial', () => {
    const drawer = readSrc('features/document-update-version/UpdateDocumentVersionDrawer.tsx');
    assert.ok(drawer.includes('confirmUpdateDocumentVersion'));
    assert.equal(drawer.includes('confirmAnalysis'), false);
  });

  it('header não usa título Envio de Documentos', () => {
    const header = readSrc('features/document-update-version/components/UpdateDocumentVersionHeader.tsx');
    assert.ok(header.includes('Atualizar documento'));
    assert.ok(header.includes('Nova versão de'));
    assert.equal(header.includes('Envio de Documentos'), false);
  });

  it('ExplorerContextMenu respeita canUpdate para habilitar ação', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('disabled={!canUpdate}'));
    assert.ok(menu.includes('onUpdateDocument'));
  });

  it('drawer bloqueia fluxo quando canUpdate é falso', () => {
    const drawer = readSrc('features/document-update-version/UpdateDocumentVersionDrawer.tsx');
    assert.ok(drawer.includes('permissions?.canUpdate'));
    assert.ok(drawer.includes('Você não tem permissão para atualizar este documento.'));
  });
});
