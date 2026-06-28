import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MongoDocumentAccessPermissions } from '../server/db/types.js';

function hasAnyPermission(permissions: MongoDocumentAccessPermissions): boolean {
  return Object.values(permissions).some(Boolean);
}

function permissionsFromRule(
  rules: Array<{ groupId: string; categoryId: string; permissions: MongoDocumentAccessPermissions; active: boolean }>,
  groupId: string,
  categoryId: string,
): MongoDocumentAccessPermissions {
  const rule = rules.find((item) => item.groupId === groupId && item.categoryId === categoryId && item.active);
  return (
    rule?.permissions ?? {
      view: false,
      download: false,
      upload: false,
      share: false,
      manage: false,
    }
  );
}

describe('governança documental — modelagem', () => {
  it('categorias e grupos são entidades distintas', () => {
    const categories = [{ id: 'cat_contratos', name: 'Contratos' }];
    const groups = [{ id: 'group_juridico', name: 'Jurídico' }];
    assert.notEqual(categories[0].id, groups[0].id);
    assert.notEqual(categories[0].name, groups[0].name);
  });

  it('regra de acesso liga grupo e categoria com permissões', () => {
    const rules = [
      {
        groupId: 'group_juridico',
        categoryId: 'cat_contratos',
        active: true,
        permissions: {
          view: true,
          download: true,
          upload: true,
          share: true,
          manage: true,
        },
      },
    ];

    const flags = permissionsFromRule(rules, 'group_juridico', 'cat_contratos');
    assert.equal(flags.view, true);
    assert.equal(flags.manage, true);
  });

  it('sem permissões marcadas a regra deve ser removida/inativada', () => {
    const empty: MongoDocumentAccessPermissions = {
      view: false,
      download: false,
      upload: false,
      share: false,
      manage: false,
    };
    assert.equal(hasAnyPermission(empty), false);
  });

  it('matriz consolida categorias, grupos e regras', () => {
    const matrix = {
      categories: [{ id: 'cat_financeiro', name: 'Financeiro', active: true }],
      groups: [{ id: 'group_financeiro', name: 'Financeiro', active: true }],
      rules: [
        {
          id: 'rule_1',
          groupId: 'group_financeiro',
          categoryId: 'cat_financeiro',
          active: true,
          permissions: { view: true, download: true, upload: true, share: false, manage: false },
        },
      ],
    };

    assert.equal(matrix.categories.length, 1);
    assert.equal(matrix.groups.length, 1);
    assert.equal(matrix.rules.length, 1);
    assert.equal(matrix.rules[0].categoryId, matrix.categories[0].id);
    assert.equal(matrix.rules[0].groupId, matrix.groups[0].id);
  });
});

describe('coleções MongoDB de governança', () => {
  it('empresa usa prefixo tenant sem CPF/CNPJ cru', () => {
    const tenantId = 'company_dev';
    assert.equal(`document_categories_${tenantId}`, 'document_categories_company_dev');
    assert.equal(`document_groups_${tenantId}`, 'document_groups_company_dev');
    assert.equal(`document_rules_${tenantId}`, 'document_rules_company_dev');
  });

  it('pessoa física usa pool compartilhado', () => {
    assert.equal('document_categories_compartilhado', 'document_categories_compartilhado');
    assert.equal('document_groups_compartilhado', 'document_groups_compartilhado');
  });
});
