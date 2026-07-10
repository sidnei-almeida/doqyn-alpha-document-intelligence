import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectLinkedDocumentGroupIds,
  isDocumentCategoryId,
  isDocumentGroupId,
} from '../src/lib/entityIds.js';
import { resolveLibraryCategoryId } from '../src/features/library/utils/resolveLibraryCategory.js';
import { listGovernanceConnections } from '../src/features/rules/utils/governanceConnections.js';
import type { DocumentCategory, Group } from '../src/types/rules.js';

const CATEGORIES = [
  { id: 'cat_juridico', name: 'Jurídico', slug: 'juridico' },
  { id: 'cat_financeiro', name: 'Financeiro', slug: 'financeiro' },
];

describe('entity IDs — classe vs grupo', () => {
  it('prefixos cat_* e group_* são distinguíveis', () => {
    assert.equal(isDocumentCategoryId('cat_juridico'), true);
    assert.equal(isDocumentGroupId('cat_juridico'), false);
    assert.equal(isDocumentGroupId('group_juridico'), true);
    assert.equal(isDocumentCategoryId('group_juridico'), false);
  });

  it('mesmo nome/slug não cruza grupo com pasta na biblioteca', () => {
    assert.equal(resolveLibraryCategoryId('juridico', CATEGORIES), 'cat_juridico');
    assert.equal(resolveLibraryCategoryId('group_juridico', CATEGORIES), undefined);
    assert.equal(resolveLibraryCategoryId('Jurídico', CATEGORIES), 'cat_juridico');
  });

  it('collectLinkedDocumentGroupIds ignora IDs que não são group_*', () => {
    const linked = collectLinkedDocumentGroupIds(
      {
        view: ['group_financeiro', 'cat_juridico'],
        download: ['group_juridico'],
      },
      ['group_rh'],
    );
    assert.deepEqual(linked.sort(), ['group_financeiro', 'group_juridico', 'group_rh'].sort());
  });
});

describe('governance connections — todas as permissões', () => {
  it('inclui grupo com download mesmo sem view', () => {
    const categories: DocumentCategory[] = [
      {
        id: 'cat_juridico',
        companyId: 'co',
        name: 'Jurídico',
        slug: 'juridico',
        icon: 'folder',
        active: true,
        documentGroupIds: [],
        notifyGroupIds: [],
        notifyOnUpdate: false,
        permissions: {
          view: [],
          download: ['group_financeiro'],
          update: [],
          audit: [],
          share: [],
        },
        keywords: [],
        negativeKeywords: [],
        createdAt: '',
      },
    ];
    const groups: Group[] = [
      {
        id: 'group_financeiro',
        companyId: 'co',
        name: 'Financeiro',
        color: 'blue',
        active: true,
        memberCount: 1,
        linkedClassCount: 1,
        createdAt: '',
      },
    ];

    const connections = listGovernanceConnections(categories, groups);
    assert.equal(connections.length, 1);
    assert.equal(connections[0]?.groupId, 'group_financeiro');
    assert.equal(connections[0]?.categoryId, 'cat_juridico');
  });
});
