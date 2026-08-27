import type { AuthUser } from '../auth/types.js';
import {
  isDocumentAdmin,
  loadDocumentAccessContext,
  userHasDocumentGroupAccess,
} from '../tenancy/documentAccess.js';
import { userHasGovernanceCategoryPermission } from '../tenancy/governanceAccessIndex.js';
import { resolveCategoryAccessGroupIds } from './documentAccessRulesService.js';
import { ServiceError } from '../utils/serviceErrors.js';

type GovernanceIndex = Awaited<ReturnType<typeof loadDocumentAccessContext>>['governanceIndex'];

/**
 * Quem alcança a categoria para enviar.
 *
 * Categoria sem grupo de atualização é aberta — o mesmo default que a governança usa em toda parte:
 * regra ausente não é regra que nega.
 */
export function userCanSubmitToCategory(input: {
  user: AuthUser;
  classId: string;
  updateGroupIds: string[];
  memberGroupIds: string[];
  governanceIndex: GovernanceIndex;
}): boolean {
  if (isDocumentAdmin(input.user)) return true;
  if (!input.updateGroupIds.length) return true;
  if (userHasDocumentGroupAccess(input.updateGroupIds, input.memberGroupIds)) return true;

  return userHasGovernanceCategoryPermission(
    input.governanceIndex,
    input.classId,
    input.memberGroupIds,
    'update',
  );
}

export function assertCanSubmitToCategory(input: {
  user: AuthUser;
  classId: string;
  updateGroupIds: string[];
  memberGroupIds: string[];
  governanceIndex: GovernanceIndex;
}): void {
  if (userCanSubmitToCategory(input)) return;

  throw new ServiceError(
    'Você não tem permissão para enviar documentos nesta categoria.',
    'DOCUMENT_UPLOAD_DENIED',
    403,
  );
}

/**
 * A mesma pergunta, quando quem chama ainda não carregou o contexto de acesso.
 *
 * Usado pela criação de pedido: **pedir é o ato de autorização**, e quem cumpre o pedido tem a
 * permissão de envio dispensada por causa disso. Se a autorização de quem pede não fosse conferida
 * aqui, a dispensa do outro lado ficaria sem origem: duas pessoas sem alcance na categoria pediriam
 * uma à outra e depositariam nela, exatamente o que a permissão de envio existe para impedir.
 */
export async function assertUserCanSubmitToCategoryId(input: {
  user: AuthUser;
  tenantId: string;
  userId: string;
  membershipId?: string;
  categoryId: string;
  message?: string;
}): Promise<void> {
  if (isDocumentAdmin(input.user)) return;

  const categoryAccess = await resolveCategoryAccessGroupIds(input.tenantId, input.categoryId, {
    ownerUserId: input.userId,
  });

  if (!categoryAccess.updateGroupIds.length) return;

  const accessCtx = await loadDocumentAccessContext({
    tenantId: input.tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const allowed = userCanSubmitToCategory({
    user: input.user,
    classId: input.categoryId,
    updateGroupIds: categoryAccess.updateGroupIds,
    memberGroupIds: accessCtx.memberGroupIds,
    governanceIndex: accessCtx.governanceIndex,
  });

  if (allowed) return;

  throw new ServiceError(
    input.message ?? 'Você não tem permissão para enviar documentos nesta categoria.',
    'DOCUMENT_UPLOAD_DENIED',
    403,
  );
}
