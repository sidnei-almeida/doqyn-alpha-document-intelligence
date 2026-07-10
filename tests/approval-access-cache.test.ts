import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { diffDocumentGroupMemberships } from '../server/services/governanceMembersService.js';
import { splitUserAccessPayload } from '../src/features/users/utils/accessFormSplit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('aprovação de acesso — persistência e cache', () => {
  it('tela de auditoria carrega grupos documentais para aprovação', () => {
    const source = readSrc('src/features/audit/hooks/useAuditCenter.ts');
    assert.ok(source.includes("queryKey: ['document-groups', tenantId]"));
    assert.ok(source.includes('usersApi.listDocumentGroups'));
    assert.equal(source.includes('usersApi.listAccessGroups'), false);
    assert.equal(source.includes("from '@/features/rules/api/rulesApi'"), false);
  });

  it('ApproveApprovalDialog usa apenas grupos documentais na UI', () => {
    const source = readSrc('src/features/audit/components/ApproveApprovalDialog.tsx');
    const sections = readSrc('src/features/users/components/AccessFormSections.tsx');
    assert.equal(source.includes('accessGroups'), false);
    assert.ok(source.includes('documentGroups'));
    assert.ok(sections.includes('title="Grupos"'));
    assert.ok(sections.includes('Mesmos grupos criados em Regras'));
    assert.ok(source.includes('documentGroupIds'));
  });

  it('usersApi.approve envia accessGroupIds e documentGroupIds separados', () => {
    const source = readSrc('src/features/users/api/usersApi.ts');
    assert.ok(source.includes('documentGroupIds: input.documentGroupIds'));
    assert.ok(source.includes('accessGroupIds: input.accessGroupIds'));
  });

  it('membershipDecisionService persiste documentGroupIds após aprovar via auth', () => {
    const source = readSrc('server/services/membershipDecisionService.ts');
    assert.ok(source.includes('syncMemberDocumentGroups'));
    assert.ok(source.includes('documentGroupIds'));
    assert.ok(source.includes('membership approve requested'));
    assert.ok(source.includes('membership approve completed'));
  });

  it('usersApi.list usa fonte única /company-members (governança)', () => {
    const source = readSrc('src/features/users/api/usersApi.ts');
    assert.ok(source.includes("request<{ members: GovernanceMemberApi[] }>(`/company-members${query}`)"));
    assert.equal(source.includes('mergeDocumentGroupIds'), false);
    assert.equal(/doqynUsersApi\.list\(/.test(source), false);
  });

  it('invalidateUserManagementQueries cobre company-members e auth-access-groups', () => {
    const source = readSrc('src/features/users/userManagementQueries.ts');
    assert.ok(source.includes("['company-members', tenantId]"));
    assert.ok(source.includes("['auth-access-groups', tenantId]"));
    assert.ok(source.includes("['document-groups', tenantId]"));
    assert.ok(source.includes("refetchType: 'all'"));
  });

  it('aprovação invalida queries de /users via helper compartilhado', () => {
    const audit = readSrc('src/features/audit/hooks/useAuditCenter.ts');
    const users = readSrc('src/features/users/UsersPage.tsx');
    assert.ok(audit.includes('invalidateUserManagementQueries'));
    assert.ok(users.includes('invalidateUserManagementQueries'));
  });

  it('login limpa cache antes de carregar nova sessão', () => {
    const source = readSrc('src/auth/AuthProvider.tsx');
    assert.ok(source.includes('queryClient.clear()'));
  });

  it('splitUserAccessPayload mantém accessGroupIds e documentGroupIds separados', () => {
    const split = splitUserAccessPayload({
      platformRoles: ['user'],
      accessGroupIds: ['group_financeiro'],
      documentGroupIds: ['group_contratos'],
    });
    assert.deepEqual(split.authService.accessGroupIds, ['group_financeiro']);
    assert.deepEqual(split.documentGovernance.documentGroupIds, ['group_contratos']);
    assert.equal(accessGroupIdsConflict(split), false);
  });

  it('diff de grupos documentais na aprovação calcula adições corretamente', () => {
    const { toAdd, toRemove } = diffDocumentGroupMemberships([], ['group_contratos']);
    assert.deepEqual(toAdd, ['group_contratos']);
    assert.deepEqual(toRemove, []);
  });
});

function accessGroupIdsConflict(split: ReturnType<typeof splitUserAccessPayload>): boolean {
  return split.authService.accessGroupIds.some((id) =>
    split.documentGovernance.documentGroupIds.includes(id),
  );
}
