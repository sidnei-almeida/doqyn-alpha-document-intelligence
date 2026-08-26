import type { MongoDocumentGroupMember } from '../../db/types.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { loadGovernanceAccessIndex } from '../../tenancy/governanceAccessIndex.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';

/**
 * Quem está em cada grupo documental, por `userId` do auth.
 *
 * Vive aqui, e não dentro do serviço de vencimento, porque toda notificação sobre documento
 * responde à mesma pergunta: quem alcança isto pela governança.
 */
export async function resolveGroupMemberUserIds(
  tenantId: string,
  groupIds: string[],
): Promise<Map<string, Set<string>>> {
  const byGroup = new Map<string, Set<string>>();
  if (groupIds.length === 0) return byGroup;

  const collections = await getTenantCollections(tenantId);
  if (!collections.documentGroupMembers) return byGroup;

  const members = (await collections.documentGroupMembers
    .find({
      ...tenantScopeFilterFromContext(collections.storage),
      groupId: { $in: groupIds },
      active: true,
    } as Record<string, unknown>)
    .toArray()) as MongoDocumentGroupMember[];

  for (const member of members) {
    if (!member.userId) continue;
    const set = byGroup.get(member.groupId) ?? new Set<string>();
    set.add(member.userId);
    byGroup.set(member.groupId, set);
  }

  return byGroup;
}

/**
 * A audiência de uma categoria: quem a **lista** por regra de grupo, mais o dono do documento.
 *
 * `view` ou `download`, e não só `view`, porque é essa a condição que o backend usa para decidir
 * se alguém enxerga o documento na biblioteca (`canUserListDocument`). Avisar por um critério mais
 * largo que o da leitura entregaria a alguém o nome de um documento que ele não pode abrir.
 *
 * O dono entra sempre, esteja ou não em grupo: é ele quem responde pelo documento, e o acesso dele
 * vem de ownership, não de regra.
 */
export async function resolveCategoryAudience(input: {
  tenantId: string;
  categoryId?: string;
  ownerUserId?: string;
  /** Restringe a audiência a estes grupos. Vazio ou ausente = todos os que alcançam. */
  restrictToGroupIds?: string[];
  /** Nunca notificar quem causou o fato. */
  excludeUserId?: string;
}): Promise<Set<string>> {
  const userIds = new Set<string>();

  if (input.categoryId) {
    const index = await loadGovernanceAccessIndex(input.tenantId);
    const reaching = new Set<string>([
      ...(index.viewByCategory.get(input.categoryId) ?? []),
      ...(index.downloadByCategory.get(input.categoryId) ?? []),
    ]);

    const restriction = input.restrictToGroupIds?.length ? new Set(input.restrictToGroupIds) : null;
    const groupIds = [...reaching].filter((groupId) => !restriction || restriction.has(groupId));

    const membersByGroup = await resolveGroupMemberUserIds(input.tenantId, groupIds);
    for (const set of membersByGroup.values()) {
      for (const userId of set) userIds.add(userId);
    }
  }

  if (input.ownerUserId) userIds.add(input.ownerUserId);
  if (input.excludeUserId) userIds.delete(input.excludeUserId);

  return userIds;
}
