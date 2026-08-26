import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import { toPermissionState, type GovernancePermissionValue } from '@shared/governancePermissions';
import type { DocumentAccessPermissions } from '../../api/rulesApi';

/** Permissões de um grupo em uma categoria, derivadas das regras ativas da matriz. */
export function getCategoryGroupPermissions(
  category: DocumentCategory,
  groupId: string,
): DocumentAccessPermissions {
  const permissions = category.permissions;
  const states = category.permissionStates;

  const resolve = (
    verb: 'view' | 'download' | 'update' | 'audit' | 'share',
  ): GovernancePermissionValue => {
    if (!permissions?.[verb].includes(groupId)) return false;
    return states?.[verb]?.[groupId] === 'require' ? 'require' : true;
  };

  return {
    view: resolve('view'),
    download: resolve('download'),
    upload: resolve('update'),
    share: resolve('share'),
    manage: resolve('audit'),
  };
}

/**
 * Tem algum caminho — liberado ou mediante pedido.
 *
 * `require` conta como conexão: o grupo alcança a categoria, só não age sem passar pelo
 * administrador. Tratá-lo como ausência esconderia a ligação do quadro de Acessos.
 */
export function hasAnyPermission(permissions: DocumentAccessPermissions): boolean {
  return (
    Object.values(permissions) as DocumentAccessPermissions[keyof DocumentAccessPermissions][]
  ).some((value) => toPermissionState(value) !== 'deny');
}

export function listConnectedGroups(category: DocumentCategory, groups: Group[]): Group[] {
  return groups.filter((group) =>
    hasAnyPermission(getCategoryGroupPermissions(category, group.id)),
  );
}

export function listAvailableGroups(category: DocumentCategory, groups: Group[]): Group[] {
  return groups.filter(
    (group) => !hasAnyPermission(getCategoryGroupPermissions(category, group.id)),
  );
}

/** Rótulo curto do nível mais alto de acesso (mesma hierarquia usada no backend). */
export function permissionSummaryLabel(permissions: DocumentAccessPermissions): string {
  const state = (key: keyof DocumentAccessPermissions) => toPermissionState(permissions[key]);

  // O nível mais alto manda, e "pedindo" é dito na frase — não é o mesmo que poder direto.
  if (state('upload') === 'allow') return 'pode alterar';
  if (state('upload') === 'require') return 'altera pedindo';
  if (state('download') === 'allow') return 'pode baixar';
  if (state('download') === 'require') return 'baixa pedindo';
  if (state('view') !== 'deny') return 'pode ver';
  if (state('share') !== 'deny') return 'compartilha pedindo';
  return 'sem acesso';
}

/** Quem lista documentos da categoria: grupos com view ou download (espelha canUserListDocument). */
function groupSeesCategory(permissions: DocumentAccessPermissions): boolean {
  return (
    toPermissionState(permissions.view) !== 'deny' ||
    toPermissionState(permissions.download) !== 'deny'
  );
}

export function countPeopleWhoSee(
  category: DocumentCategory,
  groups: Group[],
  groupMemberCounts: Record<string, number>,
): number {
  const seen = new Set<string>();
  let total = 0;
  for (const group of groups) {
    if (seen.has(group.id)) continue;
    if (!groupSeesCategory(getCategoryGroupPermissions(category, group.id))) continue;
    seen.add(group.id);
    total += groupMemberCounts[group.id] ?? group.memberCount ?? 0;
  }
  return total;
}

export type SimulationResult = { sees: true; reason: string } | { sees: false; reason: string };

function isMemberAdmin(member: CompanyMember): boolean {
  return member.role === 'admin' || member.role === 'manager';
}

/** Espelha a semântica do backend: admin vê tudo; senão, grupo com regra ativa de view/download. */
export function simulateMemberAccess(
  member: CompanyMember,
  category: DocumentCategory,
  groups: Group[],
): SimulationResult {
  const firstName = member.name.split(' ')[0] || member.name;

  if (isMemberAdmin(member)) {
    return { sees: true, reason: `${firstName} administra a empresa — vê todas as categorias` };
  }

  for (const groupId of member.groupIds) {
    if (!groupSeesCategory(getCategoryGroupPermissions(category, groupId))) continue;
    const group = groups.find((g) => g.id === groupId);
    return {
      sees: true,
      reason: `${firstName} vê porque está no ${group?.name ?? 'grupo conectado'}`,
    };
  }

  return { sees: false, reason: `${firstName} não vê esta categoria` };
}

export function describeMemberGroups(member: CompanyMember, groups: Group[]): string {
  if (isMemberAdmin(member)) return 'administra a empresa — vê todas as categorias.';
  const names = member.groupIds
    .map((id) => groups.find((g) => g.id === id)?.name)
    .filter(Boolean) as string[];
  if (names.length === 0) return 'não está em nenhum grupo; só vê o que enviou.';
  return `está em ${names.join(', ')}.`;
}
