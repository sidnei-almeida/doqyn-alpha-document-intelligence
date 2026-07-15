import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatMajorVersionLabel,
  nextMajorVersionLabel,
  normalizeVersionLabel,
  parseMajorVersionNumber,
  resolveVersionCountFromLabels,
} from '../server/utils/versionLabelUtils.js';

describe('versionLabelUtils', () => {
  it('normaliza legado v1 para v1.0', () => {
    assert.equal(normalizeVersionLabel('v1'), 'v1.0');
    assert.equal(normalizeVersionLabel(undefined), 'v1.0');
    assert.equal(normalizeVersionLabel(''), 'v1.0');
  });

  it('mantém v2.0 como está', () => {
    assert.equal(normalizeVersionLabel('v2.0'), 'v2.0');
  });

  it('calcula próxima versão major', () => {
    assert.equal(nextMajorVersionLabel('v1.0'), 'v2.0');
    assert.equal(nextMajorVersionLabel('v1'), 'v2.0');
    assert.equal(nextMajorVersionLabel('v2.0'), 'v3.0');
    assert.equal(nextMajorVersionLabel(undefined), 'v2.0');
  });

  it('parseMajorVersionNumber extrai número major', () => {
    assert.equal(parseMajorVersionNumber('v3.0'), 3);
    assert.equal(parseMajorVersionNumber('v1'), 1);
  });

  it('formatMajorVersionLabel usa .0', () => {
    assert.equal(formatMajorVersionLabel(4), 'v4.0');
  });

  it('resolveVersionCountFromLabels prioriza storedCount', () => {
    assert.equal(resolveVersionCountFromLabels(5, ['v1.0']), 5);
    assert.equal(resolveVersionCountFromLabels(undefined, ['v1.0', 'v2.0']), 2);
    assert.equal(resolveVersionCountFromLabels(undefined, []), 1);
  });
});

describe('confirmUpdateSchema', () => {
  it('exige documentId além do payload de análise', async () => {
    const { confirmUpdateSchema } = await import(
      '../server/services/confirmUpdateDocumentVersionService.js'
    );

    const base = {
      jobId: 'job_test',
      originalFileName: 'doc.pdf',
      recommendedFileName: 'Contrato_v2.pdf',
      fileHash: 'a'.repeat(64),
      fileSizeBytes: 100,
      textExtraction: { status: 'completed' as const, charCount: 10, truncated: false },
      classification: {
        classId: 'class_1',
        className: 'Contrato',
        confidence: 0.9,
        requiresReview: false,
        reason: 'ok',
        evidence: [],
      },
      extraction: {
        documentType: 'Contrato',
        version: 'v2.0',
        metadata: {},
        missingFields: [],
        requiresReview: false,
        reviewReasons: [],
      },
      logs: [],
    };

    const withoutDoc = confirmUpdateSchema.safeParse(base);
    assert.equal(withoutDoc.success, false);

    const withDoc = confirmUpdateSchema.safeParse({ ...base, documentId: 'doc_123' });
    assert.equal(withDoc.success, true);
  });
});

describe('documentAccess canContribute', () => {
  it('resolve canContribute via regra de governança (upload); canUpdate segue admin-only', async () => {
    const { resolveDocumentPermissions } = await import('../server/tenancy/documentAccess.js');
    const { buildGovernanceAccessIndex } = await import(
      '../server/tenancy/governanceAccessIndex.js'
    );
    const user = {
      id: 'user_1',
      email: 'u@test.dev',
      name: 'User',
      companyId: 'company_dev',
      tenantId: 'company_dev',
      role: 'user' as const,
      platformRoles: ['user' as const],
    };

    const governanceIndex = buildGovernanceAccessIndex([
      {
        categoryId: 'cat_1',
        groupId: 'g_update',
        active: true,
        permissions: { view: false, download: false, upload: true, share: false, manage: false },
      },
    ]);

    const perms = resolveDocumentPermissions(
      user,
      {
        ownerUserId: 'other',
        classId: 'cat_1',
        access: {
          viewGroupIds: [],
          downloadGroupIds: [],
          updateGroupIds: [],
          auditGroupIds: [],
          shareGroupIds: [],
        },
      },
      ['g_update'],
      governanceIndex,
    );

    assert.equal(perms.canContribute, true);
    assert.equal(perms.canUpdate, false);
    assert.equal(perms.canPreview, false);
  });
});

describe('frontend versionLabel helpers', () => {
  it('espelha regra de próxima versão major', async () => {
    const { nextMajorVersionLabel } = await import(
      '../src/features/documents/utils/versionLabel.ts'
    );
    assert.equal(nextMajorVersionLabel('v1.0'), 'v2.0');
    assert.equal(nextMajorVersionLabel('v2.0'), 'v3.0');
  });
});

describe('storage keys por versão', () => {
  it('objectKey inclui documentId e versionId distintos', async () => {
    const { buildDocumentVersionObjectKey } = await import('../server/storage/storageKeys.js');
    const keyV1 = buildDocumentVersionObjectKey({
      documentId: 'doc_abc',
      versionId: 'ver_001',
      storageFileName: 'Contrato_v1.pdf',
    });
    const keyV2 = buildDocumentVersionObjectKey({
      documentId: 'doc_abc',
      versionId: 'ver_002',
      storageFileName: 'Contrato_v2.pdf',
    });

    assert.notEqual(keyV1, keyV2);
    assert.match(keyV1, /doc_abc\/versions\/ver_001\/original\//);
    assert.match(keyV2, /doc_abc\/versions\/ver_002\/original\//);
  });
});

describe('confirmUpdateDocumentVersion client', () => {
  it('exporta função confirmUpdateDocumentVersion', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../src/features/document-send/services/confirmUpdateDocumentVersion.ts', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('export async function confirmUpdateDocumentVersion'));
    assert.ok(source.includes('/api/documents/confirm-update'));
  });
});

describe('ExplorerContextMenu atualização', () => {
  it('habilita item Atualizar documento com canUpdate', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../src/features/library/components/ExplorerContextMenu.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('Atualizar documento'));
    assert.ok(source.includes('canUpdate'));
    assert.ok(!source.includes('Atualizar versão'));
  });
});

describe('preview query keys incluem versionId', () => {
  it('manifest key contém versionId', async () => {
    const { previewQueryKeys } = await import(
      '../src/features/documents/preview/previewQueryKeys.ts'
    );
    const key = previewQueryKeys.manifest('tenant', 'doc_1', 'ver_2');
    assert.deepEqual(key, ['document-preview-manifest', 'tenant', 'doc_1', 'ver_2']);
  });
});

describe('DocumentVersionHistoryPanel', () => {
  it('componente existe e lista versões via API', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../src/features/library/components/DocumentVersionHistoryPanel.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('listDocumentVersions'));
    assert.ok(source.includes('VersionBadge'));
  });
});

describe('favorites por documentId', () => {
  it('serviço de favoritos indexa por documentId', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../server/services/favorites/documentFavoritesService.ts', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('documentId'));
    assert.ok(source.includes('userDocumentFavorites'));
    assert.ok(source.includes('findFavoriteDocumentIdsForUser'));
  });
});
