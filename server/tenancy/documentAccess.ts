import type { AuthUser } from '../auth/types.js';
import { getTenantCollections } from './getTenantCollections.js';
import { tenantScopeFilterFromContext } from './tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import type { MongoDocument } from '../db/types.js';
import {
  type GovernanceAccessIndex,
  userHasGovernanceCategoryPermission,
  loadGovernanceAccessIndex,
} from './governanceAccessIndex.js';

export type DocumentAccessPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canEditMetadata: boolean;
  canUpdate: boolean;
  canTrash: boolean;
  canContribute: boolean;
  canTransferOwnership: boolean;
};

/**
 * Único papel com acesso amplo aos documentos do próprio tenant (D-01).
 *
 * Em PJ o documento é ativo da empresa e o funcionário é custodiante, então `company_admin` fica.
 * `doqyn_admin` saiu porque nenhum papel de plataforma acessa documento de cliente.
 * `individual_admin` saiu junto: `mapRolesToAuthRole` o mapeia para o papel legado `manager`, e
 * enquanto ele estivesse aqui o caminho legado abaixo continuaria vivo.
 */
const DOCUMENT_ADMIN_ROLES = new Set(['company_admin']);

/**
 * Decide **apenas** por `platformRoles`, ou seja, apenas pela sessão verificada.
 *
 * O caminho legado pelos papéis `admin`/`manager` foi removido (D-03): ele promovia o campo `role`
 * replicado no documento Mongo do membro a bypass de acesso, tornando a autorização dependente de
 * dado sincronizado em vez da sessão verificada.
 */
export function isDocumentAdmin(user: AuthUser): boolean {
  const roles = user.platformRoles ?? [];
  return roles.some((role) => DOCUMENT_ADMIN_ROLES.has(role));
}

export function userHasDocumentGroupAccess(
  requiredGroupIds: string[] | undefined,
  memberGroupIds: string[],
): boolean {
  if (!requiredGroupIds?.length) return false;
  return requiredGroupIds.some((groupId) => memberGroupIds.includes(groupId));
}

/**
 * Grupos são resolvidos SEMPRE pelas regras de governança ativas (grupo ↔ categoria),
 * nunca pelo snapshot access.*GroupIds gravado no documento — o snapshot é apenas
 * informativo e fica obsoleto quando o admin desconecta um grupo no mapa de regras.
 */
export function resolveDocumentPermissions(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): DocumentAccessPermissions {
  const isAdmin = isDocumentAdmin(user);
  const isOwner = Boolean(doc.ownerUserId && doc.ownerUserId === user.id);

  const canPreview =
    isAdmin ||
    isOwner ||
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'view');

  const canDownload =
    isAdmin ||
    isOwner ||
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'download');

  const canContribute =
    isAdmin ||
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'upload');

  // O termo `isOwner` é obrigatório aqui (D-20). Sem ele, tirar `individual_admin` do set de admin
  // deixaria o tenant PF somente-leitura sobre o próprio acervo: PF não tem `company_admin` nem
  // regra de governança para compensar. Coerente com D-04 — ciclo de vida segue a leitura, e o dono
  // lê o próprio documento.
  const canUpdate = isAdmin || isOwner;
  const canTrash = isAdmin || isOwner;
  const canEditMetadata = isAdmin || isOwner;
  const canTransferOwnership = isAdmin || isOwner;

  return {
    canPreview,
    canDownload,
    canEditMetadata,
    canUpdate,
    canTrash,
    canContribute,
    canTransferOwnership,
  };
}

export function assertCanPreviewDocument(permissions: DocumentAccessPermissions): void {
  if (!permissions.canPreview) {
    throw new ServiceError(
      'Você não tem permissão para visualizar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }
}

export function assertCanDownloadDocument(permissions: DocumentAccessPermissions): void {
  if (!permissions.canDownload) {
    throw new ServiceError(
      'Você não tem permissão para baixar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }
}

export function assertCanUpdateDocument(permissions: DocumentAccessPermissions): void {
  if (!permissions.canUpdate) {
    throw new ServiceError(
      'Você não tem permissão para atualizar este documento.',
      'DOCUMENT_UPDATE_DENIED',
      403,
    );
  }
}

export function canUserTrashDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): boolean {
  return resolveDocumentPermissions(user, doc, memberGroupIds, governanceIndex).canTrash;
}

export function assertCanTrashDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): void {
  if (!canUserTrashDocument(user, doc, memberGroupIds, governanceIndex)) {
    throw new ServiceError(
      'Você não tem permissão para excluir este documento.',
      'DOCUMENT_TRASH_DENIED',
      403,
    );
  }
}

export function assertCanPermanentDeleteDocument(
  user: AuthUser,
  _doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  _memberGroupIds: string[],
  _governanceIndex?: GovernanceAccessIndex,
): void {
  if (!isDocumentAdmin(user)) {
    throw new ServiceError(
      'Você não tem permissão para excluir permanentemente este documento.',
      'DOCUMENT_PERMANENT_DELETE_DENIED',
      403,
    );
  }
}

/** Admin+ pode listar e reativar documentos na seção Desativados. */
export function assertCanManageDeactivatedDocuments(user: AuthUser): void {
  if (!isDocumentAdmin(user)) {
    throw new ServiceError(
      'Somente administradores podem gerenciar documentos desativados.',
      'DOCUMENT_DEACTIVATED_ACCESS_DENIED',
      403,
    );
  }
}

export async function loadMemberDocumentGroupIds(input: {
  tenantId: string;
  userId: string;
  membershipId?: string;
}): Promise<string[]> {
  const { documentGroupMembers, storage } = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });

  if (!documentGroupMembers) return [];

  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    userId: input.userId,
    active: true,
  };

  if (input.membershipId?.trim()) {
    query.membershipId = input.membershipId.trim();
  }

  const rows = await documentGroupMembers.find(query).toArray();
  return [...new Set(rows.map((row) => row.groupId).filter(Boolean))];
}

export async function loadDocumentAccessContext(input: {
  tenantId: string;
  userId: string;
  membershipId?: string;
}): Promise<{
  memberGroupIds: string[];
  governanceIndex: GovernanceAccessIndex;
}> {
  const [memberGroupIds, governanceIndex] = await Promise.all([
    loadMemberDocumentGroupIds(input),
    loadGovernanceAccessIndex(input.tenantId, { ownerUserId: input.userId }),
  ]);

  return { memberGroupIds, governanceIndex };
}

export function canUserListDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): boolean {
  if (isDocumentAdmin(user)) return true;
  if (doc.ownerUserId && doc.ownerUserId === user.id) return true;

  if (userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'view')) {
    return true;
  }

  if (
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'download')
  ) {
    return true;
  }

  return false;
}
