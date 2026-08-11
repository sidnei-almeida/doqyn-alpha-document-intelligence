import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canConfirmDocuments } from '../server/auth/permissions.js';
import type { AuthUser } from '../server/auth/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('document upload approval', () => {
  /**
   * Chamada real a `canConfirmDocuments`, não leitura do texto-fonte de `permissions.ts` (D-19):
   * inspeção de string não prova comportamento e quebra a cada refatoração de assinatura.
   */
  describe('canConfirmDocuments', () => {
    const OWNER_ID = 'user_owner_approval';

    function user(overrides: Partial<AuthUser> = {}): AuthUser {
      return {
        id: OWNER_ID,
        email: 'owner@teste.doqyn',
        name: 'Dono',
        companyId: 'company_approval',
        tenantId: 'company_approval',
        role: 'user',
        platformRoles: ['user'],
        membershipStatus: 'active',
        ...overrides,
      };
    }

    it('o dono confirma metadado do próprio documento (D-09)', () => {
      assert.equal(canConfirmDocuments(user(), { ownerUserId: OWNER_ID }), true);
    });

    it('company_admin confirma metadado de documento de terceiro (D-01)', () => {
      assert.equal(
        canConfirmDocuments(user({ platformRoles: ['company_admin'] }), {
          ownerUserId: 'user_terceiro',
        }),
        true,
      );
    });

    it('terceiro sem papel administrativo é enviado para aprovação', () => {
      assert.equal(canConfirmDocuments(user(), { ownerUserId: 'user_terceiro' }), false);
    });

    it('o papel de plataforma eliminado não confirma documento de terceiro (D-02)', () => {
      assert.equal(
        canConfirmDocuments(user({ platformRoles: ['doqyn_admin'] }), {
          ownerUserId: 'user_terceiro',
        }),
        false,
      );
    });
  });

  it('serviço de aprovação persiste pendências e aprova via confirmAnalysis', () => {
    const service = read('server/services/documentUploadApprovalService.ts');
    assert.ok(service.includes('submitDocumentUploadForApproval'));
    assert.ok(service.includes('approveDocumentUploadApproval'));
    assert.ok(service.includes('SHARED_APP_COLLECTIONS.documentUploadApprovals'));
    assert.ok(service.includes('skipConfirmPermissionCheck: true'));
    assert.ok(service.includes('documentOwnerUserId'));
  });

  it('expõe APIs de envio e aprovação', () => {
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('/api/documents/submit-upload-approval'));
    assert.ok(devServer.includes('/api/documents/upload-approvals'));
    assert.ok(devServer.includes('upload-approvals/[approvalId]/approve'));

    const listApi = read('api/documents/upload-approvals/index.ts');
    assert.ok(listApi.includes("from '../../../server/services/documentUploadApprovalService.js'"));

    const approveApi = read('api/documents/upload-approvals/[approvalId]/approve.ts');
    assert.ok(approveApi.includes("from '../../../../server/services/documentUploadApprovalService.js'"));

    const rejectApi = read('api/documents/upload-approvals/[approvalId]/reject.ts');
    assert.ok(rejectApi.includes("from '../../../../server/services/documentUploadApprovalService.js'"));
  });

  it('fila de upload envia para aprovação quando usuário não é admin', () => {
    const provider = read('src/features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes('submitUploadForApproval'));
    assert.ok(provider.includes('canConfirmDocumentMetadata'));
    assert.ok(provider.includes("type: 'awaiting_approval'"));
  });

  it('auditoria lista envios de documento pendentes', () => {
    const pendingApi = read('src/features/audit/api/pendingApprovalsApi.ts');
    assert.ok(pendingApi.includes('document_upload'));
    assert.ok(pendingApi.includes('listDocumentUploadApprovals'));
  });
});
