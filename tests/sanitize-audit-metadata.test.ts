import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';

describe('sanitizeAuditMetadata — changes e arrays', () => {
  it('changes[] com CPF é sanitizado', () => {
    const safe = sanitizeAuditMetadata({
      changes: [
        {
          field: 'finalFileName',
          before: 'NDA_12345678901.pdf',
          after: 'NDA.pdf',
        },
      ],
    });

    const changes = safe.changes as Array<{ before: string; after: string }>;
    assert.equal(changes[0]?.before.includes('12345678901'), false);
    assert.ok(changes[0]?.before.includes('[CPF]') || !changes[0]?.before.includes('12345678901'));
  });

  it('changes[] com CNPJ é sanitizado', () => {
    const safe = sanitizeAuditMetadata({
      changes: [
        {
          field: 'finalFileName',
          before: 'Nota_12345678000199.pdf',
          after: 'Nota.pdf',
        },
      ],
    });

    const changes = safe.changes as Array<{ before: string }>;
    assert.equal(changes[0]?.before.includes('12345678000199'), false);
  });

  it('changes[] com e-mail é sanitizado', () => {
    const safe = sanitizeAuditMetadata({
      changes: [
        {
          field: 'finalFileName',
          before: 'doc_user@empresa.com.pdf',
          after: 'doc.pdf',
        },
      ],
    });

    const changes = safe.changes as Array<{ before: string }>;
    assert.equal(changes[0]?.before.includes('@'), false);
  });

  it('arrays aninhados são sanitizados', () => {
    const safe = sanitizeAuditMetadata({
      tags: ['ok', '12345678901', { nested: 'contato@empresa.com' }],
    });

    const tags = safe.tags as unknown[];
    assert.equal(typeof tags[0], 'string');
    assert.equal(String(tags[1]).includes('12345678901'), false);
  });

  it('objectKey não aparece em metadata', () => {
    const safe = sanitizeAuditMetadata({
      objectKey: 'documents/doc/versions/ver/original/file.pdf',
      storageFileName: 'NDA_Acme.pdf',
    });

    assert.equal('objectKey' in safe, false);
    assert.equal(safe.storageFileName, 'NDA_Acme.pdf');
  });

  it('storageFileName seguro pode aparecer', () => {
    const safe = sanitizeAuditMetadata({
      storageFileName: 'NDA_Confidencialidade_v1.pdf',
      previewStorageFileName: 'NDA_Confidencialidade_v1_preview.pdf',
      namingMode: 'ai_suggested',
    });

    assert.equal(safe.storageFileName, 'NDA_Confidencialidade_v1.pdf');
    assert.equal(safe.previewStorageFileName, 'NDA_Confidencialidade_v1_preview.pdf');
    assert.equal(safe.namingMode, 'ai_suggested');
  });

  it('remove password e token de metadata', () => {
    const safe = sanitizeAuditMetadata({
      password: 'secret',
      token: 'abc123',
      requestId: 'req_1',
    });

    assert.equal('password' in safe, false);
    assert.equal('token' in safe, false);
    assert.equal(safe.requestId, 'req_1');
  });
});
