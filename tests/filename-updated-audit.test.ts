import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFilenameUpdatedAuditEvent } from '../server/audit/buildFilenameUpdatedAuditEvent.js';
import { resolveStorageFileNames } from '../server/utils/resolveStorageFileNames.js';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';

describe('confirm filename_updated — sanitização de audit', () => {
  it('evento filename_updated não contém CPF/CNPJ/e-mail em changes', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_12345678901.pdf',
      namingMode: 'manual',
      manualName: 'NDA_Manual.pdf',
      documentId: 'doc_audit_001',
      versionLabel: 'v1',
    });

    const event = buildFilenameUpdatedAuditEvent({
      namingMode: 'manual',
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_12345678901_contato@empresa.com.pdf',
      resolved,
      documentId: 'doc_audit_001',
      versionId: 'ver_audit_001',
      occurredAt: new Date(),
    });

    assert.ok(event);
    const sanitized = sanitizeAuditMetadata({
      changes: event?.changes,
      before: event?.before,
      after: event?.after,
    });

    const changes = sanitized.changes as Array<{ before: string; after: string }>;
    assert.equal(changes[0]?.before.includes('12345678901'), false);
    assert.equal(changes[0]?.before.includes('@'), false);

    const before = sanitized.before as { fileName?: string } | undefined;
    if (before?.fileName) {
      assert.equal(before.fileName.includes('12345678901'), false);
    }
  });

  it('evento não contém password/token/secret', () => {
    const event = sanitizeAuditMetadata({
      password: 'x',
      token: 'y',
      secret: 'z',
      namingMode: 'ai_suggested',
    });

    assert.equal('password' in event, false);
    assert.equal('token' in event, false);
    assert.equal('secret' in event, false);
  });
});
