import { randomUUID } from 'node:crypto';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import { addGroupMember } from '../documentGroupsService.js';
import { assertGroupIdsExist } from '../../utils/groupValidation.js';
import { logger } from '../../utils/logger.js';

/**
 * Os grupos que o convidado recebe quando aceitar, guardados até ele aceitar.
 *
 * **Por que isto existe.** Grupo de usuário mora em dois lugares que não se falam: o
 * `AuthAccessGroup` do auth-service, que o "Editar acesso" escreve, e o grupo do Mongo, que é
 * o que a governança de fato consulta — `documentGroupMembers` é a coleção que
 * `loadMemberDocumentGroupIds` lê para decidir o que a pessoa alcança. Convidar gravando só do
 * lado do auth entregaria uma conta ativa e cega.
 *
 * **Por que não resolver na hora de convidar.** No instante do convite não existe membership:
 * a pessoa pode nem ter conta. `documentGroupMembers` é indexado por `membershipId`, que só
 * nasce quando ela aceita. Então a decisão fica guardada aqui, chaveada por e-mail e tenant, e
 * é aplicada quando a membership aparece no sync.
 *
 * **Por que por e-mail.** É o único identificador que existe nas duas pontas: o convite é
 * emitido para um e-mail, e o snapshot do sync traz o e-mail do membro. O `inviteId` do
 * auth-service serviria, mas obrigaria o alpha a guardar uma chave estrangeira de outro
 * serviço para consultá-la uma vez só.
 */

export type PendingInviteGroups = {
  _id: string;
  tenantId: string;
  companyId: string;
  emailNormalized: string;
  groupIds: string[];
  invitedBy: string;
  createdAt: Date;
};

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

async function getCollection(tenantId: string, ownerUserId?: string) {
  const collections = await getTenantCollections(tenantId, { userId: ownerUserId });
  return {
    pending: collections.pendingInviteGroups,
    scope: tenantScopeFilterFromContext(collections.storage),
  };
}

/**
 * Guarda a intenção. Substitui a anterior em vez de somar: reconvidar o mesmo e-mail com outra
 * escolha de grupos precisa valer a escolha nova, não a união com a antiga.
 */
export async function storePendingInviteGroups(input: {
  tenantId: string;
  email: string;
  groupIds: string[];
  invitedBy: string;
}): Promise<void> {
  const emailNormalized = normalize(input.email);
  const groupIds = [...new Set(input.groupIds.map((id) => id.trim()).filter(Boolean))];

  const { pending, scope } = await getCollection(input.tenantId, input.invitedBy);
  if (!pending) return;

  await pending.deleteMany({ ...scope, emailNormalized } as Record<string, unknown>);
  if (groupIds.length === 0) return;

  // Grupo inexistente ou inativo derruba aqui, com o convidador ainda na tela. Deixar para o
  // aceite transferiria a falha para o convidado, por uma escolha que não foi dele.
  await assertGroupIdsExist(input.tenantId, groupIds, {
    requireActive: true,
    ownerUserId: input.invitedBy,
  });

  await pending.insertOne({
    _id: `pig_${randomUUID().slice(0, 12)}`,
    tenantId: input.tenantId,
    companyId: input.tenantId,
    emailNormalized,
    groupIds,
    invitedBy: input.invitedBy,
    createdAt: new Date(),
  } as PendingInviteGroups);
}

/**
 * Aplica o que estava guardado, no momento em que a membership aparece.
 *
 * Não lança. É chamada de dentro do sync, que existe para manter dois bancos alinhados: uma
 * falha aqui não pode derrubar a sincronização inteira e deixar o membro fora do Mongo. O que
 * falhar vira registro e a pessoa entra sem o grupo, que é recuperável pela tela de Regras.
 */
export async function applyPendingInviteGroups(input: {
  tenantId: string;
  email: string;
  membershipId: string;
  userId: string;
  displayName?: string;
}): Promise<string[]> {
  const emailNormalized = normalize(input.email);
  if (!emailNormalized) return [];

  try {
    const { pending, scope } = await getCollection(input.tenantId, input.userId);
    if (!pending) return [];
    const record = await pending.findOne({ ...scope, emailNormalized } as Record<string, unknown>);
    if (!record || record.groupIds.length === 0) return [];

    const aplicados: string[] = [];
    for (const groupId of record.groupIds) {
      try {
        await addGroupMember(input.tenantId, groupId, record.invitedBy, {
          membershipId: input.membershipId,
          userId: input.userId,
          displayName: input.displayName,
          email: emailNormalized,
        });
        aplicados.push(groupId);
      } catch (error) {
        // `DUPLICATE_MEMBER` é sucesso disfarçado: alguém já pôs a pessoa no grupo à mão entre
        // o convite e o aceite, e o resultado é o que queríamos.
        const code = (error as { code?: string })?.code;
        if (code === 'DUPLICATE_MEMBER') {
          aplicados.push(groupId);
          continue;
        }
        logger.warn('grupo do convite não pôde ser aplicado', {
          tenantId: input.tenantId,
          membershipId: input.membershipId,
          groupId,
          code,
        });
      }
    }

    // O registro sai mesmo se um grupo falhou: ele é uma intenção de uma vez só, e mantê-lo
    // faria a tentativa se repetir a cada sincronização, para sempre.
    await pending.deleteOne({ _id: record._id } as Record<string, unknown>);

    if (aplicados.length > 0) {
      logger.info('grupos do convite aplicados', {
        tenantId: input.tenantId,
        membershipId: input.membershipId,
        groupIds: aplicados,
      });
    }
    return aplicados;
  } catch (error) {
    logger.error('falha ao aplicar grupos do convite', {
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
