import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  countPeopleWhoSee,
  getCategoryGroupPermissions,
  listConnectedGroups,
  permissionSummaryLabel,
  simulateMemberAccess,
} from '../src/features/rules/components/access/accessModel.js';
import type { CompanyMember, DocumentCategory, Group } from '../src/types/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSrc(relativePath: string): string {
  return readFileSync(join(__dirname, '..', 'src', relativePath), 'utf8');
}

function makeCategory(permissions: DocumentCategory['permissions']): DocumentCategory {
  return {
    id: 'cat_juridico',
    companyId: 'company_dev',
    name: 'Documentos Jurídicos',
    icon: 'folder',
    active: true,
    documentGroupIds: [],
    notifyGroupIds: [],
    notifyOnUpdate: false,
    permissions,
    keywords: [],
    negativeKeywords: [],
    createdAt: new Date().toISOString(),
  };
}

function makeGroup(id: string, memberCount: number): Group {
  return {
    id,
    companyId: 'company_dev',
    name: `Grupo ${id}`,
    color: 'blue',
    active: true,
    memberCount,
    createdAt: new Date().toISOString(),
  };
}

function makeMember(role: CompanyMember['role'], groupIds: string[]): CompanyMember {
  return {
    id: 'member_1',
    companyId: 'company_dev',
    name: 'Maria Souza',
    email: 'maria@doqyn.dev',
    role,
    status: 'active',
    groupIds,
    createdAt: new Date().toISOString(),
  };
}

describe('accessModel — permissões derivadas das regras', () => {
  const category = makeCategory({
    view: ['g_juridico'],
    download: ['g_juridico'],
    update: [],
    audit: [],
    share: [],
  });

  it('deriva permissões de um grupo a partir da matriz da categoria', () => {
    const perms = getCategoryGroupPermissions(category, 'g_juridico');
    assert.equal(perms.view, true);
    assert.equal(perms.download, true);
    assert.equal(perms.upload, false);
    assert.equal(permissionSummaryLabel(perms), 'pode baixar');
  });

  it('lista apenas grupos com alguma permissão ativa', () => {
    const groups = [makeGroup('g_juridico', 4), makeGroup('g_rh', 5)];
    const connected = listConnectedGroups(category, groups);
    assert.deepEqual(
      connected.map((g) => g.id),
      ['g_juridico'],
    );
  });

  it('conta pessoas que veem somando membros dos grupos com view/download', () => {
    const groups = [makeGroup('g_juridico', 4), makeGroup('g_rh', 5)];
    assert.equal(countPeopleWhoSee(category, groups, { g_juridico: 4, g_rh: 5 }), 4);
  });
});

describe('accessModel — simulador "Ver como" (espelha o backend)', () => {
  const groups = [makeGroup('g_juridico', 4)];
  const category = makeCategory({
    view: ['g_juridico'],
    download: [],
    update: [],
    audit: [],
    share: [],
  });

  it('admin vê todas as categorias', () => {
    const result = simulateMemberAccess(makeMember('admin', []), category, groups);
    assert.equal(result.sees, true);
  });

  it('membro de grupo conectado vê com o motivo', () => {
    const result = simulateMemberAccess(makeMember('member', ['g_juridico']), category, groups);
    assert.equal(result.sees, true);
    assert.match(result.reason, /Grupo g_juridico/);
  });

  it('membro sem grupo conectado não vê (regra desconectada revoga)', () => {
    const disconnected = makeCategory({
      view: [],
      download: [],
      update: [],
      audit: [],
      share: [],
    });
    const result = simulateMemberAccess(
      makeMember('member', ['g_juridico']),
      disconnected,
      groups,
    );
    assert.equal(result.sees, false);
  });
});

describe('RulesPage — vistas de acesso', () => {
  it('usa cards + matriz com mutação por célula, sem o mapa de nós', () => {
    const page = readSrc('features/rules/RulesPage.tsx');
    assert.ok(page.includes('CategoryAccessCard'));
    assert.ok(page.includes('AccessMatrixView'));
    assert.ok(page.includes('updateGroupClassPermissions'));
    assert.ok(page.includes('simulateMemberAccess'));
    assert.equal(page.includes('GovernanceMapCanvas'), false);
  });
});
