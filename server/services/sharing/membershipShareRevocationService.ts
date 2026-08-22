import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { logger } from '../../utils/logger.js';

export type RevokeMembershipSharesInput = {
  tenantId: string;
  /** Quem concedeu os acessos. É por ele que os grants são encontrados. */
  userId: string;
  membershipId?: string;
  /** `membership_removed` | `membership_blocked` — vai para a trilha, não muda o efeito. */
  reason?: string;
};

export type RevokeMembershipSharesResult = {
  ok: true;
  tenantId: string;
  userId: string;
  revokedInternal: number;
  revokedExternal: number;
};

/**
 * Revoga todos os compartilhamentos concedidos por um membro, internos e externos.
 *
 * Existe porque o acesso concedido sobrevivia ao vínculo de quem concedeu: desligado o funcionário,
 * a sessão dele morria na hora, mas o link externo que ele tinha criado continuava servindo o
 * arquivo a um terceiro sem login, e o compartilhamento interno continuava na lista do colega.
 * `resolveExternalShareAccess` não tem como saber disso sozinho — o vínculo vive no auth-service —,
 * então quem desliga é que precisa avisar.
 *
 * Idempotente: revogar duas vezes devolve zero na segunda, porque o filtro só pega grant vivo.
 */
export async function revokeSharesGrantedByMembership(
  input: RevokeMembershipSharesInput,
): Promise<RevokeMembershipSharesResult> {
  const tenantId = input.tenantId?.trim();
  const userId = input.userId?.trim();

  if (!tenantId) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }
  if (!userId) {
    throw new ServiceError('userId é obrigatório.', 'USER_REQUIRED', 400);
  }
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const db = await getDb();
  const now = new Date();
  const revokedBy = input.membershipId?.trim() || userId;

  const internal = await db.collection(SHARED_APP_COLLECTIONS.documentShareGrants).updateMany(
    {
      tenantId,
      sharedByUserId: userId,
      status: { $nin: ['revoked', 'expired'] },
    } as Record<string, unknown>,
    {
      $set: {
        status: 'revoked',
        revokedAt: now,
        revokedBy,
        revokedReason: input.reason ?? 'membership_ended',
        updatedAt: now,
      },
    },
  );

  const external = await db
    .collection(SHARED_APP_COLLECTIONS.externalDocumentShareGrants)
    .updateMany(
      {
        tenantId,
        sharedByUserId: userId,
        status: { $nin: ['revoked', 'expired'] },
      } as Record<string, unknown>,
      {
        $set: {
          status: 'revoked',
          revokedAt: now,
          revokedBy,
          revokedReason: input.reason ?? 'membership_ended',
          updatedAt: now,
        },
      },
    );

  const result: RevokeMembershipSharesResult = {
    ok: true,
    tenantId,
    userId,
    revokedInternal: internal.modifiedCount,
    revokedExternal: external.modifiedCount,
  };

  logger.info('shares revoked for membership', {
    tenantId,
    userId,
    membershipId: input.membershipId,
    reason: input.reason,
    revokedInternal: result.revokedInternal,
    revokedExternal: result.revokedExternal,
  });

  return result;
}
