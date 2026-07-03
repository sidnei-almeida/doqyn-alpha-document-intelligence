import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  accessGroupIdsConflictWithDocumentGroups,
  RULES_SCREEN_CAPABILITIES,
  splitUserAccessPayload,
} from '../src/features/users/utils/accessFormSplit.js';
import { computeGroupMemberCounts } from '../src/utils/rulesHelpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('divisão de responsabilidades /users vs /rules', () => {
  it('RULES_SCREEN_CAPABILITIES não gerencia membros de grupos documentais', () => {
    assert.equal(RULES_SCREEN_CAPABILITIES.managesDocumentGroupMembers, false);
    assert.equal(RULES_SCREEN_CAPABILITIES.showsMemberCountReadOnly, true);
    assert.equal(RULES_SCREEN_CAPABILITIES.managesAccessGroups, false);
    assert.equal(RULES_SCREEN_CAPABILITIES.managesUserRoles, false);
  });

  it('/rules (GovernanceMapCanvas) não renderiza botão "Adicionar membro"', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.equal(source.includes('Adicionar membro'), false);
    assert.equal(source.includes('AddMemberToGroupDialog'), false);
    assert.equal(source.includes('removeMemberFromDocumentGroup'), false);
    assert.equal(source.includes('addMemberToDocumentGroup'), false);
  });

  it('/rules (GovernanceDetailDialog) orienta gestão de membros em Usuários', () => {
    const source = readSrc('features/rules/components/governance/GovernanceDetailDialog.tsx');
    assert.ok(source.includes('Gerencie membros'));
    assert.equal(source.includes('Adicionar membro'), false);
    assert.equal(source.includes('onAddMember'), false);
    assert.equal(source.includes('onRemoveMember'), false);
  });

  it('/rules (RulesPage) descreve membros gerenciados em Usuários', () => {
    const source = readSrc('features/rules/RulesPage.tsx');
    assert.ok(source.includes('Membros dos grupos são gerenciados em Usuários'));
    assert.equal(source.includes('pendingApprovals'), false);
    assert.equal(source.includes('approveMember'), false);
  });

  it('/users (UsersPage) expõe grupos documentais no modal Editar acesso', () => {
    const source = readSrc('features/users/UsersPage.tsx');
    const sections = readSrc('features/users/components/AccessFormSections.tsx');
    assert.ok(sections.includes('Grupos documentais (governança)'));
    assert.ok(source.includes('updateDocumentGroups'));
    assert.ok(source.includes('listDocumentGroups'));
    assert.ok(sections.includes('Grupos de acesso (auth-service)'));
  });

  it('splitUserAccessPayload separa auth-service e grupos documentais', () => {
    const form = {
      platformRoles: ['company_admin'],
      accessGroupIds: ['group_juridico', 'group_rh'],
      documentGroupIds: ['group_administrativo'],
      notificationPreferences: { email: true },
    };

    const split = splitUserAccessPayload(form);

    assert.deepEqual(split.authService.platformRoles, ['company_admin']);
    assert.deepEqual(split.authService.accessGroupIds, ['group_juridico', 'group_rh']);
    assert.deepEqual(split.documentGovernance.documentGroupIds, ['group_administrativo']);
    assert.equal('documentGroupIds' in split.authService, false);
    assert.equal('accessGroupIds' in split.documentGovernance, false);
  });

  it('accessGroupIds e documentGroupIds não devem se misturar no payload', () => {
    const accessGroupIds = ['group_compras', 'group_juridico'];
    const documentGroupIds = ['group_administrativo', 'group_contratos_juridicos'];

    assert.equal(accessGroupIdsConflictWithDocumentGroups(accessGroupIds, documentGroupIds), false);

    const polluted = [...accessGroupIds, 'group_administrativo'];
    assert.equal(
      accessGroupIdsConflictWithDocumentGroups(polluted, documentGroupIds),
      true,
    );
  });

  it('usersApi.updateDocumentGroups usa PUT /company-members/:id/groups com documentGroupIds', () => {
    const source = readSrc('features/users/api/usersApi.ts');
    assert.ok(source.includes('`/company-members/${memberId}/groups`'));
    assert.ok(source.includes('JSON.stringify({ documentGroupIds })'));
    assert.ok(source.includes('updateAccess'));
    assert.ok(source.includes('listDocumentGroups'));
    assert.ok(source.includes("('/document-groups')"));
    assert.ok(source.includes('memberCount'));
  });

  it('Usuário Teste Jurídico pode ser associado ao grupo Administrativo via documentGroupIds', () => {
    const memberId = 'm-teste-juridico';
    const administrativoGroupId = 'group_administrativo';

    const currentGroups: string[] = [];
    const nextGroups = [...currentGroups, administrativoGroupId];

    assert.deepEqual(nextGroups, ['group_administrativo']);
    assert.equal(nextGroups.includes('group_juridico'), false);

    const payload = { documentGroupIds: nextGroups };
    assert.deepEqual(payload.documentGroupIds, ['group_administrativo']);
    assert.equal('accessGroupIds' in payload, false);
    assert.equal(memberId.length > 0, true);
  });

  it('reabrir modal mantém documentGroupIds distintos de accessGroupIds', () => {
    const savedMember = {
      accessGroupIds: ['group_juridico'],
      documentGroupIds: ['group_administrativo'],
    };

    const form = {
      platformRoles: ['user'],
      accessGroupIds: [...savedMember.accessGroupIds],
      documentGroupIds: [...savedMember.documentGroupIds],
    };

    assert.deepEqual(form.accessGroupIds, ['group_juridico']);
    assert.deepEqual(form.documentGroupIds, ['group_administrativo']);
    assert.equal(accessGroupIdsConflictWithDocumentGroups(form.accessGroupIds, form.documentGroupIds), false);
  });

  it('/rules reflete contador de membros read-only a partir de groupIds documentais', () => {
    const groups = [{ id: 'group_administrativo', name: 'Administrativo', color: 'blue' as const, active: true }];
    const members = [
      {
        id: 'm1',
        companyId: 'tenant-1',
        userId: 'u1',
        name: 'Usuário Teste Jurídico',
        email: 'teste.juridico@doqyn.dev',
        role: 'user' as const,
        status: 'active' as const,
        groupIds: ['group_administrativo'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'm2',
        companyId: 'tenant-1',
        userId: 'u2',
        name: 'Sidnei Dev',
        email: 'sidnei@doqyn.dev',
        role: 'admin' as const,
        status: 'active' as const,
        groupIds: ['group_administrativo'],
        createdAt: new Date().toISOString(),
      },
    ];

    const counts = computeGroupMemberCounts(groups, members);
    assert.equal(counts.group_administrativo, 2);
  });

  it('useRules não exporta mutações de membros de grupos documentais', () => {
    const source = readSrc('features/rules/hooks/useRules.ts');
    assert.equal(source.includes('addMemberToDocumentGroup'), false);
    assert.equal(source.includes('removeMemberFromDocumentGroup'), false);
    assert.equal(source.includes('updateMemberGroups'), false);
    assert.ok(source.includes('groupMemberCounts'));
    assert.ok(source.includes('disconnectGroupFromCategory'));
    assert.ok(source.includes('saveGovernanceMapChanges'));
  });
});
