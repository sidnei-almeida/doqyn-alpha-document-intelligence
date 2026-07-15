import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGovernanceAccessIndex,
  listGovernanceViewableCategoryIds,
  userHasGovernanceCategoryPermission,
} from '../server/tenancy/governanceAccessIndex.js';
import { canUserListDocument, resolveDocumentPermissions } from '../server/tenancy/documentAccess.js';
import type { AuthUser } from '../server/auth/types.js';

function commonUser(): AuthUser {
  return {
    id: 'user_financeiro',
    email: 'financeiro@doqyn.dev',
    name: 'Financeiro',
    companyId: 'company_dev',
    tenantId: 'company_dev',
    role: 'user',
    platformRoles: ['user'],
  };
}

const governanceIndex = buildGovernanceAccessIndex([
  {
    categoryId: 'cat_juridico',
    groupId: 'group_financeiro',
    active: true,
    permissions: {
      view: true,
      download: true,
      upload: false,
      share: false,
      manage: false,
    },
  },
]);

describe('governance runtime access', () => {
  it('usuário financeiro vê documento jurídico via regra ativa, mesmo sem snapshot', () => {
    const user = commonUser();
    const doc = {
      ownerUserId: 'user_outro',
      classId: 'cat_juridico',
      access: {
        viewGroupIds: ['group_juridico'],
        downloadGroupIds: ['group_juridico'],
        updateGroupIds: [],
        auditGroupIds: [],
        shareGroupIds: [],
      },
    };

    assert.equal(canUserListDocument(user, doc, ['group_financeiro'], governanceIndex), true);

    const perms = resolveDocumentPermissions(user, doc, ['group_financeiro'], governanceIndex);
    assert.equal(perms.canPreview, true);
    assert.equal(perms.canDownload, true);
    assert.equal(perms.canUpdate, false);
  });

  it('desconectar o grupo revoga acesso mesmo com snapshot antigo no documento', () => {
    const user = commonUser();
    const doc = {
      ownerUserId: 'user_outro',
      classId: 'cat_juridico',
      access: {
        viewGroupIds: ['group_juridico'],
        downloadGroupIds: ['group_juridico'],
        updateGroupIds: [],
        auditGroupIds: [],
        shareGroupIds: [],
      },
    };

    const emptyIndex = buildGovernanceAccessIndex([]);

    // Usuário está no grupo carimbado no documento, mas a regra grupo ↔ categoria
    // foi desconectada — o snapshot não pode mais conceder acesso.
    assert.equal(canUserListDocument(user, doc, ['group_juridico'], emptyIndex), false);
    assert.equal(canUserListDocument(user, doc, ['group_juridico']), false);

    const perms = resolveDocumentPermissions(user, doc, ['group_juridico'], emptyIndex);
    assert.equal(perms.canPreview, false);
    assert.equal(perms.canDownload, false);
  });

  it('lista categorias visíveis via governança para dashboard/query', () => {
    const categoryIds = listGovernanceViewableCategoryIds(governanceIndex, ['group_financeiro']);
    assert.deepEqual(categoryIds, ['cat_juridico']);
    assert.equal(
      userHasGovernanceCategoryPermission(
        governanceIndex,
        'cat_juridico',
        ['group_financeiro'],
        'view',
      ),
      true,
    );
  });
});
