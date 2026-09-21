import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import { toPermissionState } from '@shared/governancePermissions';
import { getCategoryGroupPermissions } from '../access/accessModel';

/** Um grupo alcança a categoria quando lista documentos dela (espelha `countPeopleWhoSee`). */
function groupReachesCategory(category: DocumentCategory, groupId: string): boolean {
  const permissions = getCategoryGroupPermissions(category, groupId);
  return (
    toPermissionState(permissions.view) !== 'deny' ||
    toPermissionState(permissions.download) !== 'deny'
  );
}

export type GovernanceStepId = 'groups' | 'people' | 'categories';

export type GovernanceStep = {
  id: GovernanceStepId;
  /** Os números moram em `GovernanceProgress`; a frase, no placar, no idioma da tela. */
  done: boolean;
};

export type GovernanceProgress = {
  totalPeople: number;
  peopleInGroups: number;
  /** Pessoas que alcançam ao menos uma categoria por regra de grupo. */
  peopleReached: number;
  groupCount: number;
  categoryCount: number;
  connectedCategoryCount: number;
  steps: GovernanceStep[];
  /** Fração de 0 a 1 de pessoas alcançadas — o placar depois que a trilha fecha. */
  coverage: number;
  complete: boolean;
};

/**
 * O estado da governança em três perguntas: existem grupos, tem gente neles, e eles
 * alcançam categorias?
 *
 * A tela mostrava só a terceira. Com a segunda vazia — ninguém em grupo — todas as faixas
 * marcavam "0 pessoas veem" e nada dizia por quê: a regra estava certa e o efeito era nulo.
 */
export function computeGovernanceProgress(
  categories: DocumentCategory[],
  groups: Group[],
  members: CompanyMember[],
): GovernanceProgress {
  const activeMembers = members.filter((member) => member.status === 'active');
  const totalPeople = activeMembers.length;
  const peopleInGroups = activeMembers.filter((member) => member.groupIds.length > 0).length;

  const reachingGroupIds = new Set(
    groups
      .filter((group) => categories.some((category) => groupReachesCategory(category, group.id)))
      .map((group) => group.id),
  );

  const peopleReached = activeMembers.filter((member) =>
    member.groupIds.some((groupId) => reachingGroupIds.has(groupId)),
  ).length;

  const connectedCategoryCount = categories.filter((category) =>
    groups.some((group) => groupReachesCategory(category, group.id)),
  ).length;

  const steps: GovernanceStep[] = [
    { id: 'groups', done: groups.length > 0 },
    { id: 'people', done: peopleInGroups > 0 },
    { id: 'categories', done: connectedCategoryCount > 0 },
  ];

  return {
    totalPeople,
    peopleInGroups,
    peopleReached,
    groupCount: groups.length,
    categoryCount: categories.length,
    connectedCategoryCount,
    steps,
    coverage: totalPeople === 0 ? 0 : peopleReached / totalPeople,
    complete: steps.every((step) => step.done),
  };
}

export type CategoryReachState = 'reached' | 'empty-groups' | 'unreached';

export type CategoryReach = {
  state: CategoryReachState;
  peopleCount: number;
  groupCount: number;
  /** Fração de 0 a 1 das pessoas da empresa que alcançam esta categoria. */
  coverage: number;
};

export function computeCategoryReach(
  category: DocumentCategory,
  groups: Group[],
  peopleCount: number,
  totalPeople: number,
): CategoryReach {
  const groupCount = groups.filter((group) => groupReachesCategory(category, group.id)).length;
  const state: CategoryReachState =
    peopleCount > 0 ? 'reached' : groupCount > 0 ? 'empty-groups' : 'unreached';

  return {
    state,
    peopleCount,
    groupCount,
    coverage: totalPeople === 0 ? 0 : peopleCount / totalPeople,
  };
}
