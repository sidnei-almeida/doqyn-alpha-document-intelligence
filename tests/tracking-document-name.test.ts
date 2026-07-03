import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildFilenameUpdatedAuditEvent } from '../server/audit/buildFilenameUpdatedAuditEvent.js';
import {
  buildAnalysisJobNameSnapshot,
  buildDocumentNameSnapshot,
  DOCUMENT_NAME_FALLBACK,
  redactDocumentName,
  resolveTrackingDocumentName,
} from '../server/audit/documentNameSnapshot.js';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';

describe('documentNameSnapshot helpers', () => {
  it('analysis_started usa originalFileName', () => {
    const name = buildAnalysisJobNameSnapshot({
      originalFileName: 'ACORDO_DE_CONFIDENCIALIDADE.pdf',
    });
    assert.equal(name, 'ACORDO_DE_CONFIDENCIALIDADE.pdf');
  });

  it('analysis_completed prioriza recommendedFileName', () => {
    const name = buildAnalysisJobNameSnapshot({
      originalFileName: 'original.pdf',
      recommendedFileName: 'ACORDO_FINAL.pdf',
    });
    assert.equal(name, 'ACORDO_FINAL.pdf');
  });

  it('document.storage_promoted usa finalFileName no snapshot', () => {
    const name = buildDocumentNameSnapshot({
      finalFileName: 'ACORDO_FINAL_v1.pdf',
      storageFileName: 'juridico_ACORDO_DE_CONFIDENCIALIDADE_v1.pdf',
    });
    assert.equal(name, 'ACORDO_FINAL_v1.pdf');
  });

  it('resolveTrackingDocumentName prioriza target.nameSnapshot', () => {
    const resolved = resolveTrackingDocumentName({
      metadata: {
        target: { type: 'document', id: 'doc_1', nameSnapshot: 'Nome histórico.pdf' },
      },
      documentId: 'doc_1',
      documentNames: new Map([['doc_1', 'Nome atual.pdf']]),
    });
    assert.equal(resolved, 'Nome histórico.pdf');
  });

  it('resolveTrackingDocumentName faz fallback para metadata.documentName', () => {
    const resolved = resolveTrackingDocumentName({
      metadata: { documentName: 'ACORDO.pdf' },
      documentId: null,
      documentNames: new Map(),
    });
    assert.equal(resolved, 'ACORDO.pdf');
  });

  it('resolveTrackingDocumentName faz fallback para metadata.storageFileName', () => {
    const resolved = resolveTrackingDocumentName({
      metadata: { storageFileName: 'NDA_v1.pdf' },
      documentId: 'doc_1',
      documentNames: new Map(),
    });
    assert.equal(resolved, 'NDA_v1.pdf');
  });

  it('sem nomes retorna fallback amigável', () => {
    const resolved = resolveTrackingDocumentName({
      metadata: {},
      documentId: null,
      documentNames: new Map(),
    });
    assert.equal(resolved, DOCUMENT_NAME_FALLBACK);
  });

  it('redige CPF/CNPJ/e-mail em nomes', () => {
    const safe = redactDocumentName('doc_12345678901_user@empresa.com.pdf');
    assert.equal(safe.includes('12345678901'), false);
    assert.equal(safe.includes('@'), false);
    assert.match(safe, /\[CPF\]|\[email\]/);
  });
});

describe('audit emitters — nameSnapshot', () => {
  it('document.version_created via filename_updated inclui target.nameSnapshot', () => {
    const event = buildFilenameUpdatedAuditEvent({
      namingMode: 'manual',
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'sugerido.pdf',
      recommendedFileName: 'sugerido.pdf',
      resolved: {
        namingMode: 'manual',
        aiSuggestedFileName: 'sugerido.pdf',
        selectedFileName: 'manual.pdf',
        finalFileName: 'manual.pdf',
        storageFileName: 'juridico_manual_v1.pdf',
        previewStorageFileName: 'juridico_manual_v1_preview.pdf',
      },
      documentId: 'doc_1',
      versionId: 'ver_1',
      occurredAt: new Date(),
    });

    assert.ok(event);
    assert.equal(event?.target?.nameSnapshot, 'manual.pdf');
    assert.equal(event?.target?.type, 'document');
  });

  it('sanitizeAuditMetadata preserva target.nameSnapshot e documentName', () => {
    const safe = sanitizeAuditMetadata({
      target: {
        type: 'analysis_job',
        id: 'job_1',
        nameSnapshot: 'ACORDO.pdf',
      },
      documentName: 'ACORDO.pdf',
      originalFileName: 'ACORDO.pdf',
      objectKey: 'tenant/doc/key.pdf',
    });

    const target = safe.target as Record<string, unknown>;
    assert.equal(target.nameSnapshot, 'ACORDO.pdf');
    assert.equal(safe.documentName, 'ACORDO.pdf');
    assert.equal('objectKey' in safe, false);
    assert.equal('originalFileName' in safe, false);
    assert.equal(safe.hasOriginalFileName, true);
  });
});

describe('tracking UI — coluna Documento', () => {
  const tableSource = readFileSync(
    join(process.cwd(), 'src/features/tracking/components/TrackingEventsTable.tsx'),
    'utf8',
  );
  const cellSource = readFileSync(
    join(process.cwd(), 'src/features/tracking/components/TrackingDocumentCell.tsx'),
    'utf8',
  );
  const drawerSource = readFileSync(
    join(process.cwd(), 'src/features/tracking/components/TrackingEventDetailsDrawer.tsx'),
    'utf8',
  );

  it('tabela usa TrackingDocumentCell com nome obrigatório', () => {
    assert.match(tableSource, /TrackingDocumentCell/);
    assert.match(tableSource, /item\.document\.name/);
    assert.doesNotMatch(tableSource, /objectKey/);
  });

  it('célula usa title com nome completo', () => {
    assert.match(cellSource, /title=\{name\}/);
    assert.match(cellSource, /truncate/);
    assert.match(cellSource, /max-w-/);
  });

  it('drawer mostra nome completo sem depender só de documentId', () => {
    assert.match(drawerSource, /event\.document\.name/);
    assert.match(drawerSource, /break-words/);
  });
});
