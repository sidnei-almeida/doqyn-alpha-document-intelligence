import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAuthUserDisplayName } from '../server/utils/userDisplayName.js';
import { buildDocumentMutationFields, buildInitialDocumentOwnershipFields } from '../server/utils/documentMutationFields.js';
import { canTransferDocumentOwnership } from '../server/services/documentTransferOwnershipService.js';
import { resolveDocumentPermissions } from '../server/tenancy/documentAccess.js';
import type { AuthUser } from '../server/auth/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function businessUser(id: string, role: AuthUser['role'] = 'user'): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    companyId: 'tenant_a',
    tenantId: 'tenant_a',
    role,
    groups: [],
    tenantType: 'business',
    platformRoles: role === 'admin' ? ['company_admin'] : ['user'],
  };
}

describe('proprietário do documento', () => {
  it('resolveAuthUserDisplayName prioriza nome completo', () => {
    assert.equal(
      resolveAuthUserDisplayName({
        firstName: 'Rafael',
        lastName: 'Mendes',
        email: 'rafael@example.com',
      }),
      'Rafael Mendes',
    );
  });

  it('buildInitialDocumentOwnershipFields define owner e updatedBy iniciais iguais', () => {
    const fields = buildInitialDocumentOwnershipFields({
      ownerUserId: 'user_owner',
      ownerName: 'Owner Name',
    });
    assert.equal(fields.ownerUserId, 'user_owner');
    assert.equal(fields.createdBy, 'user_owner');
    assert.equal(fields.updatedBy, 'user_owner');
    assert.equal(fields.updatedByName, 'Owner Name');
  });

  it('buildDocumentMutationFields não altera ownerUserId', () => {
    const mutation = buildDocumentMutationFields({
      actorUserId: 'user_editor',
      actorDisplayName: 'Editor',
    });
    assert.equal(mutation.updatedBy, 'user_editor');
    assert.equal(mutation.updatedByName, 'Editor');
    assert.equal('ownerUserId' in mutation, false);
  });

  it('confirmAnalysis persiste ownerUserId, ownerName e updatedBy', () => {
    const service = read('server/services/confirmAnalysisService.ts');
    assert.ok(service.includes('buildInitialDocumentOwnershipFields'));
    assert.ok(service.includes('ownerName: ownershipFields.ownerName'));
    assert.ok(service.includes('updatedBy: ownershipFields.updatedBy'));
  });

  it('aprovação de upload repassa nome do solicitante', () => {
    const service = read('server/services/documentUploadApprovalService.ts');
    assert.ok(service.includes('documentOwnerDisplayName: approval.submittedBy.name'));
  });

  it('listagem enriquece nomes e separa createdBy do proprietário', () => {
    const listItems = read('server/services/documentListItems.ts');
    assert.ok(listItems.includes('loadTenantMemberDisplayNames'));
    assert.ok(listItems.includes('createdByUserId'));
    assert.ok(listItems.includes('updatedByName'));
    assert.ok(listItems.includes('canTransferOwnership'));
  });

  it('nenhum fluxo comum faz $set de ownerUserId fora da transferência', () => {
    const paths = [
      'server/services/confirmUpdateDocumentVersionService.ts',
      'server/services/documentMoveService.ts',
      'server/services/trash/documentTrashService.ts',
      'server/services/signatures/promoteSignedPdfToDocumentVersion.ts',
    ];
    for (const path of paths) {
      const source = read(path);
      assert.equal(source.includes('$set: { ownerUserId'), false, path);
    }
    const transfer = read('server/services/documentTransferOwnershipService.ts');
    assert.ok(transfer.includes('ownerUserId: resolvedNewOwnerUserId'));
  });

  it('transferência permitida para proprietário ou admin', () => {
    const doc = { ownerUserId: 'owner_1', access: {}, classId: 'class_1' };
    assert.equal(
      canTransferDocumentOwnership(businessUser('owner_1'), doc),
      true,
    );
    assert.equal(
      canTransferDocumentOwnership(businessUser('other'), doc),
      false,
    );
    assert.equal(
      resolveDocumentPermissions(businessUser('other', 'admin'), doc, []).canTransferOwnership,
      true,
    );
  });

  it('API de transferência registra auditoria', () => {
    const api = read('api/documents/[documentId]/transfer-ownership.ts');
    assert.ok(api.includes('document.ownership_transferred'));
    assert.ok(api.includes('transferDocumentOwnership'));
  });
});
