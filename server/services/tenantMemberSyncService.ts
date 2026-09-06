import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../db/mongoClient.js';
import type {
  AccessRequestSource,
  MongoTenantMember,
  PlatformRole,
  TenantMemberStatus,
} from '../db/types.js';
import { fetchAuthTenantMembersForSync } from '../integrations/doqynAuthInternalClient.js';
import type { AuthTenantMemberSyncSnapshot } from '../integrations/authTenantMemberTypes.js';
import { normalizeEmail } from '../utils/contactNormalize.js';
import { logger } from '../utils/logger.js';
import { applyPendingInviteGroups } from './invites/pendingInviteGroupsService.js';
import {
  deactivateMemberGroupsForInactiveMember,
  restoreMemberGroupsForActiveMember,
} from './documentGroupsService.js';
import { notifyMemberJoined } from './notifications/memberNotifications.js';

export type { AuthTenantMemberSyncSnapshot } from '../integrations/authTenantMemberTypes.js';

const SYNC_TTL_MS = 15_000;
const lastSyncedAtByTenant = new Map<string, number>();

function mapAuthStatus(status: string): TenantMemberStatus {
  if (status === 'removed') return 'rejected';
  if (status === 'active' || status === 'pending' || status === 'blocked' || status === 'rejected') {
    return status;
  }
  return 'rejected';
}

function mapPlatformRoles(roles: string[]): PlatformRole[] {
  const allowed: PlatformRole[] = ['company_admin', 'individual_admin', 'user'];
  const mapped = roles.filter((role): role is PlatformRole =>
    allowed.includes(role as PlatformRole),
  );
  return mapped.length > 0 ? mapped : ['user'];
}

function mapAccessRequestSource(
  source: AuthTenantMemberSyncSnapshot['source'] | undefined,
): AccessRequestSource {
  if (source === 'access_request') return 'public_form';
  if (source === 'admin_invite' || source === 'migration' || source === 'manual_seed') {
    return source;
  }
  return 'admin_invite';
}

export function invalidateTenantMemberSyncCache(tenantId: string): void {
  lastSyncedAtByTenant.delete(tenantId);
}

export async function upsertTenantMemberFromAuthSnapshot(
  snapshot: AuthTenantMemberSyncSnapshot,
): Promise<MongoTenantMember> {
  if (!isMongoNativeConfigured()) {
    throw new Error('MongoDB não configurado para sincronizar tenant_members.');
  }

  const db = await getDb();
  const now = new Date();
  const email = snapshot.email.trim().toLowerCase();
  const emailNormalized = normalizeEmail(email);
  const firstName = snapshot.firstName?.trim() || undefined;
  const lastName = snapshot.lastName?.trim() || undefined;
  const tenantRoles = mapPlatformRoles(snapshot.tenantRoles);
  const status = mapAuthStatus(snapshot.status);
  const approvedAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : undefined;
  const createdAt = snapshot.createdAt ? new Date(snapshot.createdAt) : now;
  const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : now;

  const memberDoc: MongoTenantMember = {
    _id: snapshot.membershipId,
    memberId: snapshot.membershipId,
    tenantId: snapshot.tenantId,
    companyId: snapshot.tenantId,
    authUserId: snapshot.userId,
    username: email,
    email,
    emailNormalized,
    firstName,
    lastName,
    whatsapp: snapshot.whatsapp?.trim() || undefined,
    status,
    tenantRoles,
    accessGroupIds: snapshot.accessGroupIds ?? [],
    ...(snapshot.jobTitle || snapshot.departmentText || snapshot.source
      ? {
          requestedAccess: {
            jobTitle: snapshot.jobTitle?.trim() || undefined,
            departmentText: snapshot.departmentText?.trim() || undefined,
            requestedAt: approvedAt ?? createdAt,
            source: mapAccessRequestSource(snapshot.source),
          },
        }
      : {}),
    invitedBy: snapshot.invitedBy ?? undefined,
    approvedAt,
    createdAt,
    updatedAt,
  };

  const memberFields = { ...memberDoc };
  delete (memberFields as Partial<typeof memberDoc>).createdAt;

  const existingByEmail = await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
    tenantId: snapshot.tenantId,
    emailNormalized,
  } as Record<string, unknown>);

  if (existingByEmail && existingByEmail._id !== snapshot.membershipId) {
    await db
      .collection(REGISTRY_COLLECTIONS.tenantMembers)
      .deleteOne({ _id: existingByEmail._id } as Record<string, unknown>);
  }

  /**
   * O status que este membro tinha no Mongo antes desta rodada.
   *
   * Só vale quando é a mesma membership: um documento achado pelo e-mail com outro `_id` é
   * resquício de uma membership anterior, e acabou de ser apagado logo acima.
   */
  const previousStatus =
    existingByEmail && existingByEmail._id === snapshot.membershipId
      ? existingByEmail.status
      : undefined;

  const upsertResult = await db.collection(REGISTRY_COLLECTIONS.tenantMembers).updateOne(
    { _id: snapshot.membershipId } as Record<string, unknown>,
    {
      $setOnInsert: { createdAt },
      $set: memberFields,
      $unset: { keycloakUserId: '' },
    },
    { upsert: true },
  );
  /** Verdadeiro só na primeira vez que este membro chega ao Mongo. */
  const memberIsNew = upsertResult.upsertedCount > 0;

  const saved = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne({ _id: snapshot.membershipId } as Record<string, unknown>);

  if (!saved) {
    throw new Error(`Falha ao sincronizar tenant_member ${snapshot.email}.`);
  }

  /**
   * O convite prometeu grupos; é aqui que a promessa vira acesso.
   *
   * Só depois do upsert, só para quem chegou ativo, e **só quando o membro é novo**.
   *
   * `documentGroupMembers` é indexado por `membershipId`, que não existia quando o convite foi
   * criado; este é o primeiro instante em que a pessoa tem membership e o alpha sabe disso. E é
   * o único instante que interessa: quem aceita um convite entra no Mongo pela primeira vez
   * aqui.
   *
   * A condição de novidade não é economia de estilo. Sem ela a consulta rodava para todo membro
   * ativo a cada sincronização — e o sync percorre o tenant inteiro a cada quinze segundos, o
   * que num tenant de duzentas pessoas são duzentas idas ao banco por ciclo, numa coleção que
   * fica vazia o tempo todo.
   *
   * Não bloqueia nem lança — o serviço engole a própria falha. Sincronizar dois bancos é o
   * trabalho desta função, e um grupo que não colou não pode deixar o membro fora do Mongo.
   */
  if (status === 'active' && memberIsNew) {
    await applyPendingInviteGroups({
      tenantId: snapshot.tenantId,
      email: emailNormalized,
      membershipId: snapshot.membershipId,
      userId: snapshot.userId,
      displayName: [firstName, lastName].filter(Boolean).join(' ').trim() || undefined,
    });

    // Depois dos grupos, e não antes: o aviso diz que a pessoa entrou, e ela só entrou de fato
    // quando alcança alguma coisa. Avisar primeiro mandaria quem administra olhar uma conta que
    // ainda não enxerga documento nenhum.
    await notifyMemberJoined({ tenantId: snapshot.tenantId, member: saved });
  }

  await syncGroupMembershipWithMemberStatus({
    tenantId: snapshot.tenantId,
    membershipId: snapshot.membershipId,
    userId: snapshot.userId,
    previousStatus,
    status,
  });

  return saved;
}

/**
 * O vínculo de grupo acompanha a saída e a volta do membro.
 *
 * **Só na virada.** O sync percorre o tenant inteiro a cada quinze segundos; agir por status, e
 * não por mudança de status, seria uma escrita por membro por ciclo para não mudar nada. Membro
 * novo também não vira: quem acabou de chegar não tem vínculo anterior a desfazer, e o que o
 * convite prometeu foi aplicado logo acima.
 *
 * **Não lança.** É chamada de dentro da sincronização, que existe para manter dois bancos
 * alinhados. Um vínculo que não pôde ser mexido não pode deixar o membro fora do Mongo — e o
 * acesso de quem está bloqueado já está fechado pela revogação de sessão do auth, então falhar
 * aqui não abre porta nenhuma.
 */
async function syncGroupMembershipWithMemberStatus(input: {
  tenantId: string;
  membershipId: string;
  userId: string;
  previousStatus: TenantMemberStatus | undefined;
  status: TenantMemberStatus;
}): Promise<void> {
  if (!input.previousStatus || input.previousStatus === input.status) return;

  const wasActive = input.previousStatus === 'active';
  const isActive = input.status === 'active';
  if (wasActive === isActive) return;

  try {
    // `ownerUserId` é o que dá escopo certo no tenant PF, onde a coleção é compartilhada e o
    // filtro é por dono. No PJ ele não muda nada — o escopo já é o tenant.
    const opts = { ownerUserId: input.userId };
    const changed = isActive
      ? await restoreMemberGroupsForActiveMember(
          input.tenantId,
          { membershipId: input.membershipId },
          opts,
        )
      : await deactivateMemberGroupsForInactiveMember(
          input.tenantId,
          { membershipId: input.membershipId },
          opts,
        );

    if (changed > 0) {
      logger.info('vínculos de grupo acompanharam o status do membro', {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        from: input.previousStatus,
        to: input.status,
        changed,
      });
    }
  } catch (error) {
    logger.warn('vínculos de grupo não puderam acompanhar o status do membro', {
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      from: input.previousStatus,
      to: input.status,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function syncTenantMembersFromAuth(tenantId: string): Promise<number> {
  if (!isMongoNativeConfigured()) {
    return 0;
  }

  const snapshots = await fetchAuthTenantMembersForSync(tenantId);
  let synced = 0;

  for (const snapshot of snapshots) {
    await upsertTenantMemberFromAuthSnapshot(snapshot);
    synced += 1;
  }

  lastSyncedAtByTenant.set(tenantId, Date.now());

  logger.info('tenant members synced from auth', {
    tenantId,
    syncedCount: synced,
  });

  return synced;
}

export async function ensureTenantMembersSyncedForOperations(
  tenantId: string,
  options?: { force?: boolean },
): Promise<void> {
  if (!isMongoNativeConfigured()) {
    return;
  }

  if (options?.force) {
    invalidateTenantMemberSyncCache(tenantId);
  }

  const lastSyncedAt = lastSyncedAtByTenant.get(tenantId) ?? 0;
  if (!options?.force && Date.now() - lastSyncedAt < SYNC_TTL_MS) {
    return;
  }

  try {
    await syncTenantMembersFromAuth(tenantId);
  } catch (error) {
    logger.warn('tenant member sync failed', {
      tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
