import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveStorageFileNames } from '../shared/storageFileName.ts';
import { previewFinalFileName } from '../src/features/document-send/utils/resolveDocumentNaming.ts';
import { resolveFinalFileNameForConfirm } from '../src/features/document-send/utils/reviewWorkflowSettings.ts';
import { DEFAULT_WORKFLOW_REVIEW_SETTINGS } from '../src/features/document-send/utils/reviewWorkflowSettings.ts';

describe('paridade frontend/backend — nomes de storage', () => {
  it('previewFinalFileName remove CPF igual ao backend', () => {
    const input = {
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_12345678901_Acme.pdf',
      namingMode: 'ai_suggested' as const,
      documentId: 'doc_preview_001',
      versionLabel: 'v1',
    };

    const frontend = previewFinalFileName(input);
    const backend = resolveStorageFileNames({
      ...input,
      namingMode: input.namingMode,
    });

    assert.equal(frontend, backend.finalFileName);
    assert.equal(frontend.includes('12345678901'), false);
  });

  it('previewFinalFileName remove CNPJ igual ao backend', () => {
    const input = {
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'Nota_12345678000199_Fornecedor.pdf',
      namingMode: 'ai_suggested' as const,
      documentId: 'doc_cnpj_001',
      versionLabel: 'v1',
    };

    const frontend = previewFinalFileName(input);
    const backend = resolveStorageFileNames(input);

    assert.equal(frontend, backend.finalFileName);
    assert.equal(frontend.includes('12345678000199'), false);
  });

  it('previewFinalFileName remove e-mail igual ao backend', () => {
    const input = {
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_contato@empresa.com.pdf',
      namingMode: 'ai_suggested' as const,
      documentId: 'doc_email_001',
      versionLabel: 'v1',
    };

    const frontend = previewFinalFileName(input);
    const backend = resolveStorageFileNames(input);

    assert.equal(frontend, backend.finalFileName);
    assert.equal(frontend.includes('@'), false);
  });

  it('previewFinalFileName bloqueia original.pdf com fallback', () => {
    const input = {
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'original.pdf',
      namingMode: 'original' as const,
      documentId: 'doc_block_original',
      versionLabel: 'v1',
    };

    const frontend = previewFinalFileName(input);
    const backend = resolveStorageFileNames(input);

    assert.equal(frontend, backend.finalFileName);
    assert.equal(frontend, 'Documento_block_origin_v1.pdf');
  });

  it('resolveFinalFileNameForConfirm compatível com backend para modo IA', () => {
    const frontend = resolveFinalFileNameForConfirm({
      settings: DEFAULT_WORKFLOW_REVIEW_SETTINGS,
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'NDA_12345678901_Acme.pdf',
      perItem: { namingMode: 'ai_suggested' },
    });

    const backend = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'NDA_12345678901_Acme.pdf',
      namingMode: 'ai_suggested',
      documentId: 'preview_doc',
      versionLabel: 'v1',
    });

    assert.equal(frontend, backend.finalFileName);
  });
});
