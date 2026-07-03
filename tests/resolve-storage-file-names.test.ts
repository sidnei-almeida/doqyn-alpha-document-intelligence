import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPreviewStorageFileName,
  buildStorageFileNameFallback,
  resolveStorageFileNames,
} from '../server/utils/resolveStorageFileNames.js';
import { buildDocumentPreviewObjectKey, buildDocumentVersionObjectKey } from '../server/storage/storageKeys.js';

describe('resolveStorageFileNames', () => {
  it('modo ai_suggested usa nome da IA sanitizado', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'contrato original.pdf',
      aiSuggestedFileName: 'NDA_Acme_2024_v1.pdf',
      namingMode: 'ai_suggested',
    });

    assert.equal(resolved.namingMode, 'ai_suggested');
    assert.equal(resolved.finalFileName, 'NDA_Acme_2024_v1.pdf');
    assert.equal(resolved.storageFileName, 'NDA_Acme_2024_v1.pdf');
    assert.equal(resolved.previewStorageFileName, 'NDA_Acme_2024_v1_preview.pdf');
  });

  it('modo ai_suggested prioriza finalFileName enviado pelo confirm', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'NDA_Sugerido_IA.pdf',
      namingMode: 'ai_suggested',
      finalFileName: 'NDA_Confidencialidade_2026-07-02_v1.pdf',
    });

    assert.equal(resolved.finalFileName, 'NDA_Confidencialidade_2026-07-02_v1.pdf');
    assert.equal(resolved.storageFileName, 'NDA_Confidencialidade_2026-07-02_v1.pdf');
    assert.equal(resolved.previewStorageFileName, 'NDA_Confidencialidade_2026-07-02_v1_preview.pdf');
    assert.equal(resolved.finalFileName.includes('original'), false);
  });

  it('modo original usa nome do upload sanitizado', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'Meu Contrato (final).pdf',
      aiSuggestedFileName: 'NDA_Sugerido.pdf',
      namingMode: 'original',
    });

    assert.equal(resolved.finalFileName, 'Meu_Contrato_final.pdf');
    assert.equal(resolved.storageFileName, 'Meu_Contrato_final.pdf');
  });

  it('modo manual usa nome informado pelo usuário', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'IA.pdf',
      namingMode: 'manual',
      manualName: 'Nome Personalizado.pdf',
    });

    assert.equal(resolved.selectedFileName, 'Nome_Personalizado.pdf');
    assert.equal(resolved.finalFileName, 'Nome_Personalizado.pdf');
  });

  it('força extensão .pdf e remove caracteres inválidos', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'arquivo.pdf',
      aiSuggestedFileName: 'tipo/força\\..pdf',
      namingMode: 'ai_suggested',
      documentId: 'doc_test_001',
      versionLabel: 'v1',
    });

    assert.equal(resolved.finalFileName.endsWith('.pdf'), true);
    assert.equal(resolved.finalFileName.includes('/'), false);
    assert.equal(resolved.finalFileName.includes('\\'), false);
    assert.equal(resolved.finalFileName, 'tipoforca.pdf');
  });

  it('remove CPF/CNPJ/e-mail do storageFileName', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_12345678901_contato@empresa.com.pdf',
      namingMode: 'ai_suggested',
      documentId: 'doc_sensitive',
      versionLabel: 'v1',
    });

    assert.equal(resolved.storageFileName.includes('12345678901'), false);
    assert.equal(resolved.storageFileName.includes('@'), false);
    assert.equal(resolved.storageFileName.endsWith('.pdf'), true);
  });

  it('usa fallback seguro quando nome da IA é inválido ou vazio', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: '',
      namingMode: 'ai_suggested',
      documentId: 'doc_abc123def456',
      versionLabel: 'v2',
    });

    assert.equal(resolved.finalFileName, 'Documento_abc123def456_v2.pdf');
    assert.equal(resolved.storageFileName, 'Documento_abc123def456_v2.pdf');
  });

  it('original.pdf vira fallback seguro em modo original', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'IA.pdf',
      namingMode: 'original',
      documentId: 'doc_legacy_001',
      versionLabel: 'v1',
    });

    assert.equal(resolved.storageFileName, 'Documento_legacy_001_v1.pdf');
    assert.notEqual(resolved.storageFileName, 'original.pdf');
  });

  it('preview.pdf vira fallback seguro', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'preview.pdf',
      aiSuggestedFileName: 'preview.pdf',
      namingMode: 'ai_suggested',
      documentId: 'doc_preview_block',
      versionLabel: 'v1',
    });

    assert.equal(resolved.storageFileName, 'Documento_preview_bloc_v1.pdf');
    assert.equal(resolved.previewStorageFileName, 'Documento_preview_bloc_v1_preview.pdf');
  });

  it('documento.pdf continua usando fallback', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'documento.pdf',
      aiSuggestedFileName: 'documento.pdf',
      namingMode: 'ai_suggested',
      documentId: 'doc_generic',
      versionLabel: 'v1',
    });

    assert.equal(resolved.storageFileName, 'Documento_generic_v1.pdf');
  });

  it('não usa original.pdf como nome final quando upload é genérico com IA', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'NDA_Confidencialidade_2026-07-02_v1.pdf',
      namingMode: 'ai_suggested',
      finalFileName: 'NDA_Confidencialidade_2026-07-02_v1.pdf',
    });

    assert.equal(resolved.storageFileName, 'NDA_Confidencialidade_2026-07-02_v1.pdf');
    assert.notEqual(resolved.storageFileName, 'original.pdf');
  });

  it('buildPreviewStorageFileName gera sufixo _preview', () => {
    assert.equal(buildPreviewStorageFileName('Contrato_NDA.pdf'), 'Contrato_NDA_preview.pdf');
  });

  it('buildStorageFileNameFallback usa documentId e versão', () => {
    assert.equal(
      buildStorageFileNameFallback('doc_abc123def456', 'v3'),
      'Documento_abc123def456_v3.pdf',
    );
  });

  it('objectKey final usa storageFileName e não original.pdf', () => {
    const documentId = 'doc_flow_001';
    const versionId = 'ver_flow_001';
    const storageFileName = 'NDA_Confidencialidade_2026-07-02_v1.pdf';
    const previewStorageFileName = buildPreviewStorageFileName(storageFileName);

    const originalKey = buildDocumentVersionObjectKey({
      documentId,
      versionId,
      storageFileName,
    });
    const previewKey = buildDocumentPreviewObjectKey({
      documentId,
      versionId,
      previewStorageFileName,
    });

    assert.equal(
      originalKey,
      `documents/${documentId}/versions/${versionId}/original/${storageFileName}`,
    );
    assert.equal(
      previewKey,
      `documents/${documentId}/versions/${versionId}/preview/${previewStorageFileName}`,
    );
    assert.ok(!originalKey.endsWith('/original.pdf'));
    assert.ok(!previewKey.endsWith('/preview.pdf'));
    assert.ok(!previewKey.includes('/preview/preview.pdf'));
  });

  it('individual/PF inclui basePrefix opaco com filename final', () => {
    const basePrefix = 'individuals/sha256hash';
    const storageFileName = 'NDA_Confidencialidade_2026-07-02_v1.pdf';

    const key = buildDocumentVersionObjectKey({
      documentId: 'doc_pf_001',
      versionId: 'ver_pf_001',
      storageFileName,
      basePrefix,
    });

    assert.equal(
      key,
      `${basePrefix}/documents/doc_pf_001/versions/ver_pf_001/original/${storageFileName}`,
    );
  });
});
