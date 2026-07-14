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

describe('migrate keycloakUserId → authUserId', () => {
  it('tipos Mongo usam authUserId como campo canônico', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('authUserId?: string'));
    assert.equal(types.includes('keycloakUserId?: string'), false);
  });

  it('helper resolveMemberAuthUserId usa só authUserId/userId', () => {
    const helper = read('server/utils/memberAuthUserId.ts');
    assert.ok(helper.includes('resolveMemberAuthUserId'));
    assert.ok(helper.includes('member.authUserId ?? member.userId'));
    assert.equal(helper.includes('keycloakUserId'), false);
  });

  it('script de migração renomeia e valida owners', () => {
    const script = read('scripts/migrate-keycloak-to-auth-user-id.ts');
    const pkg = read('package.json');
    assert.ok(pkg.includes('db:migrate-keycloak-to-auth-user-id'));
    assert.ok(script.includes("$rename: { [LEGACY_FIELD]: NEW_FIELD }"));
    assert.ok(script.includes('verifyDocumentOwnerReferences'));
    assert.ok(script.includes('ownerUserId'));
    assert.ok(script.includes('--apply'));
  });

  it('sync e seed gravam authUserId', () => {
    const sync = read('server/services/tenantMemberSyncService.ts');
    const members = read('server/services/tenantMembersService.ts');
    assert.ok(sync.includes('authUserId: snapshot.userId'));
    assert.ok(sync.includes("$unset: { keycloakUserId: '' }"));
    assert.ok(members.includes('authUserId: SIDNEI_DEV_USER_ID'));
    assert.equal(sync.includes('keycloakUserId: snapshot.userId'), false);
  });

  it('queries de lookup usam authUserId (sem dual-read keycloak)', () => {
    const display = read('server/utils/userDisplayName.ts');
    const transfer = read('server/services/documentTransferOwnershipService.ts');
    const share = read('server/services/sharing/documentShareService.ts');
    assert.ok(display.includes('{ authUserId: input.ownerUserId }'));
    assert.equal(display.includes('keycloakUserId'), false);
    assert.ok(transfer.includes('{ authUserId: userId }'));
    assert.equal(transfer.includes('keycloakUserId'), false);
    assert.equal(share.includes('keycloakUserId'), false);
  });

  it('persistência de membros não grava keycloakUserId', () => {
    const repo = read('server/services/tenantMemberRepository.ts');
    const sync = read('server/services/tenantMemberSyncService.ts');
    assert.ok(repo.includes("$unset: { keycloakUserId: '' }"));
    assert.ok(sync.includes("$unset: { keycloakUserId: '' }"));
    assert.equal(repo.includes('keycloakUserId: authUserId'), false);
    assert.equal(sync.includes('keycloakUserId: snapshot.userId'), false);
  });

  it('índices usam authUserId', () => {
    const setup = read('server/db/setupMongo.ts');
    const indexes = read('scripts/ensure-mongodb-indexes.ts');
    assert.ok(setup.includes('{ key: { authUserId: 1, status: 1 } }'));
    assert.ok(indexes.includes('{ key: { tenantId: 1, authUserId: 1 } }'));
    assert.equal(setup.includes('keycloakUserId: 1, status: 1'), false);
  });

  it('frontend não depende de keycloakUserId', () => {
    const modal = read('src/features/documents/components/TransferOwnershipModal.tsx');
    const session = read('src/auth/sessionTypes.ts');
    const usersApi = read('src/features/users/api/usersApi.ts');
    assert.equal(modal.includes('keycloakUserId'), false);
    assert.equal(session.includes('keycloakUserId'), false);
    assert.equal(usersApi.includes('keycloakUserId'), false);
  });
});
