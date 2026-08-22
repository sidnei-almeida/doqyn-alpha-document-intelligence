import type { VercelRequest } from '@vercel/node';
import type { AuthUser } from '../auth/types.js';
import { canViewDocumentTracking } from '../auth/permissions.js';
import { loadDocumentAccessContext, userGovernsTenantScope } from '../tenancy/documentAccess.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import {
  requireDocumentAuthContext,
  type DocumentAuthContext,
} from '../tenancy/documentRequestContext.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type TrackingAccessScope = {
  /**
   * Quando presente, o acesso é decidido **por documento**: o dono vê a trilha do próprio documento
   * mesmo sem governar o tenant (D-07). Ausente, a rota cobre o tenant inteiro e exige governança.
   */
  documentId?: string;
};

/**
 * Guarda das rotas de tracking.
 *
 * Dois modos, e a diferença importa:
 *
 * - **Sem documento em escopo** (ex.: `/api/tracking/summary`, que agrega o tenant inteiro): decide
 *   por `userGovernsTenantScope` — `company_admin` em PJ, usuário único do pool em PF. O usuário
 *   comum de PJ recebe 403 `TRACKING_FORBIDDEN`.
 * - **Com documento em escopo**: quem governa o tenant continua passando, o dono do documento passa
 *   também — sem este caminho o dono não veria a trilha do próprio documento, que é o que D-07
 *   existe para garantir — e passa ainda quem pertence a grupo com o verbo `audit` na classe do
 *   documento, porque essa é a configuração que o tenant faz no mapa de regras.
 *
 * O documento é buscado pelo filtro de escopo do tenant, então uma sonda cross-tenant (ou
 * cross-usuário no pool PF) devolve 404 antes de chegar na camada de permissão.
 */
export async function requireDocumentTrackingAccess(
  req: VercelRequest,
  res: { status: (code: number) => { json: (body: unknown) => void } },
  scope?: TrackingAccessScope,
): Promise<DocumentAuthContext | null> {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return null;

  if (userGovernsTenantScope(auth.user, auth.ctx.storage)) {
    return auth;
  }

  const documentId = scope?.documentId?.trim();
  if (documentId) {
    const { documents, storage } = await getTenantCollections(auth.ctx.tenantId, {
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
    });

    const doc = await documents.findOne({
      ...tenantScopeFilterFromContext(storage),
      _id: documentId,
    } as Record<string, unknown>);

    if (!doc) {
      res.status(404).json({
        message: 'Documento não encontrado.',
        code: 'DOCUMENT_NOT_FOUND',
      });
      return null;
    }

    const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
      tenantId: auth.ctx.tenantId,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
    });

    if (
      canViewDocumentTracking(auth.user, {
        ownerUserId: doc.ownerUserId,
        classId: doc.classId,
        memberGroupIds,
        governanceIndex,
      })
    ) {
      return auth;
    }
  }

  res.status(403).json({
    message: 'Você não tem permissão para visualizar o tracking documental desta organização.',
    code: 'TRACKING_FORBIDDEN',
  });
  return null;
}

export function assertTrackingAccess(user: AuthUser, scope?: { ownerUserId?: string }): void {
  if (!canViewDocumentTracking(user, scope)) {
    throw new ServiceError(
      'Você não tem permissão para visualizar o tracking documental desta organização.',
      'TRACKING_FORBIDDEN',
      403,
    );
  }
}
