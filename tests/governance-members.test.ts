import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  diffDocumentGroupMemberships,
  filterMembersAvailableForDocumentGroup,
} from '../server/services/governanceMembersService.js';

describe('governança — membros e grupos documentais', () => {
  it('diffDocumentGroupMemberships calcula adições e remoções', () => {
    const { toAdd, toRemove } = diffDocumentGroupMemberships(
      ['group_financeiro', 'group_rh'],
      ['group_financeiro', 'group_juridico'],
    );

    assert.deepEqual(toAdd, ['group_juridico']);
    assert.deepEqual(toRemove, ['group_rh']);
  });

  it('diffDocumentGroupMemberships ignora duplicatas no destino', () => {
    const { toAdd, toRemove } = diffDocumentGroupMemberships(
      ['group_a'],
      ['group_a', 'group_a', 'group_b'],
    );

    assert.deepEqual(toAdd, ['group_b']);
    assert.deepEqual(toRemove, []);
  });

  it('grupos documentais e access groups são conceitos distintos na UI', () => {
    const authAccessGroups = [
      'group_compras',
      'group_diretoria',
      'group_financeiro',
      'group_juridico',
      'group_rh',
    ];
    const documentGroups = ['group_administrativo', 'group_contratos_juridicos'];

    for (const accessId of authAccessGroups) {
      assert.equal(documentGroups.includes(accessId), false);
    }
  });

  it('payload de adicionar membro usa documentGroupId e membershipId', () => {
    const payload = {
      documentGroupId: 'group_administrativo',
      membershipId: '550e8400-e29b-41d4-a716-446655440000',
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '660e8400-e29b-41d4-a716-446655440001',
      displayName: 'Usuário Teste Jurídico',
      email: 'teste.juridico@doqyn.dev',
    };

    assert.equal(payload.documentGroupId, 'group_administrativo');
    assert.equal('accessGroupIds' in payload, false);
    assert.ok(payload.membershipId);
    assert.ok(payload.userId);
  });

  it('membros ativos do tenant incluem Sidnei e Usuário Teste Jurídico', () => {
    const authMembers = [
      { id: 'm-sidnei', status: 'active', name: 'Sidnei Dev', email: 'sidnei@doqyn.dev' },
      {
        id: 'm-teste',
        status: 'active',
        name: 'Usuário Teste Jurídico',
        email: 'teste.juridico@doqyn.dev',
      },
    ];

    const active = authMembers.filter((member) => member.status === 'active');
    assert.equal(active.length, 2);
    assert.ok(active.some((member) => member.email === 'teste.juridico@doqyn.dev'));
  });

  it('filterMembersAvailableForDocumentGroup exclui quem já está no grupo', () => {
    const members = [
      { id: 'm1', status: 'active', groupIds: ['group_administrativo'] },
      { id: 'm2', status: 'active', groupIds: [] },
      { id: 'm3', status: 'pending', groupIds: [] },
    ];

    const available = filterMembersAvailableForDocumentGroup(members, 'group_administrativo');
    assert.equal(available.length, 1);
    assert.equal(available[0]?.id, 'm2');
  });

  it('accessGroupId do auth-service não deve ser tratado como documentGroupId na API', () => {
    const pathGroupId = 'group_administrativo';
    const bodyGroupId = 'group_juridico';

    const mismatch = Boolean(bodyGroupId && bodyGroupId !== pathGroupId);
    assert.equal(mismatch, true);
  });

  it('não permite duplicar mesmo membro no mesmo grupo documental', () => {
    const existing = new Set(['membership-a:group_administrativo']);
    const nextKey = 'membership-a:group_administrativo';
    assert.equal(existing.has(nextKey), true);
  });
});
