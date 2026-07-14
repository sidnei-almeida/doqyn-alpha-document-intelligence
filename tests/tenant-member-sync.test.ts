import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('tenant member sync — auth para mongo', () => {
  it('repositório expõe listOperationalTenantMembers como fonte única operacional', () => {
    const repo = read('server/services/tenantMemberRepository.ts');
    assert.ok(repo.includes('listOperationalTenantMembers'));
    assert.ok(repo.includes('syncTenantMembersFromAuth'));
  });

  it('serviço sincroniza membros do auth-service para tenant_members', () => {
    const service = read('server/services/tenantMemberSyncService.ts');
    assert.ok(service.includes('upsertTenantMemberFromAuthSnapshot'));
    assert.ok(service.includes('syncTenantMembersFromAuth'));
    assert.ok(service.includes('ensureTenantMembersSyncedForOperations'));
    assert.ok(service.includes('authUserId'));
    assert.ok(service.includes('snapshot.userId'));
  });

  it('cliente interno consulta /internal/tenants/:tenantId/members', () => {
    const client = read('server/integrations/doqynAuthInternalClient.ts');
    assert.ok(client.includes('fetchAuthTenantMembersForSync'));
    assert.ok(client.includes('/internal/tenants/'));
  });

  it('compartilhamento sincroniza antes de listar usuários', () => {
    const share = read('server/services/sharing/documentShareService.ts');
    assert.ok(share.includes('listOperationalTenantMembers'));
  });

  it('assinatura interna sincroniza antes de validar signatário', () => {
    const validation = read('server/services/signatures/signatureRecipientValidation.ts');
    assert.ok(validation.includes('listOperationalTenantMembers'));
  });

  it('decisões de membership forçam sync após approve/reject no auth', () => {
    const decisions = read('server/services/membershipDecisionService.ts');
    assert.ok(decisions.includes('syncTenantMembersFromAuth'));
    assert.ok(decisions.includes('invalidateTenantMemberSyncCache'));
  });

  it('endpoint interno persiste membro vindo do auth-service', () => {
    const endpoint = read('api/internal/tenant-members/sync.ts');
    assert.ok(endpoint.includes('upsertTenantMemberFromAuthSnapshot'));
    assert.ok(endpoint.includes('assertAppInternalApiKey'));
  });
});
