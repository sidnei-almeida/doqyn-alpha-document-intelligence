import type { AuthUser } from '../auth/types.js';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import type { MongoCompanyMember, MongoDocument, MongoTenantMember } from '../db/types.js';
import {
  isDocumentAdmin,
  loadDocumentAccessContext,
  resolveDocumentPermissions,
} from '../tenancy/documentAccess.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { ServiceError } from '../utils/serviceErrors.js';
import {
  buildDocumentMutationFields,
  resolveDocumentActorIdentity,
} from '../utils/documentMutationFields.js';
import { resolveDocumentOwnerName } from '../utils/userDisplayName.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
};

async function findActiveTenantMemberUserId(
  tenantId: string,
  userId: string,
): Promise<MongoTenantMember | null> {
  const db = await getDb();
  const statusFilter = { status: 'active' as const };

  const member = await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
    tenantId,
    $or: [{ keycloakUserId: userId }, { memberId: userId }, { _id: userId }],
    ...statusFilter,
  } as Record<string, unknown>);

  if (member) return member;

  const legacy = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    companyId: tenantId,
    $or: [{ keycloakUserId: userId }, { userId }, { _id: userId }],
    ...statusFilter,
  } as Record<string, unknown>);

  if (!legacy) return null;

  const resolvedTenantId = legacy.tenantId ?? legacy.companyId;
  if (resolvedTenantId !== tenantId) return null;

  return legacy as unknown as MongoTenantMember;
}

function resolveMemberUserId(member: MongoTenantMember): string {
  return member.keycloakUserId ?? member.memberId ?? String(member._id);
}

export type TransferDocumentOwnershipResult = {
  documentId: string;
  previousOwnerUserId: string;
  previousOwnerName?: string;
  newOwnerUserId: string;
  newOwnerName: string;
  transferredAt: string;
};

export async function transferDocumentOwnership(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  newOwnerUserId: string,
  reason?: string,
): Promise<TransferDocumentOwnershipResult> {
  const normalizedNewOwnerId = newOwnerUserId.trim();
  if (!normalizedNewOwnerId) {
    throw new ServiceError('Novo proprietário é obrigatório.', 'NEW_OWNER_REQUIRED', 400);
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const mongoDoc = doc as MongoDocument;
  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });
  const permissions = resolveDocumentPermissions(
    user,
    mongoDoc,
    memberGroupIds,
    governanceIndex,
  );

  if (!permissions.canTransferOwnership) {
    throw new ServiceError(
      'Você não tem permissão para transferir a propriedade deste documento.',
      'DOCUMENT_OWNERSHIP_TRANSFER_DENIED',
      403,
    );
  }

  const currentOwnerUserId = mongoDoc.ownerUserId;
  if (!currentOwnerUserId) {
    throw new ServiceError(
      'Documento sem proprietário registrado.',
      'DOCUMENT_OWNER_MISSING',
      409,
    );
  }

  if (currentOwnerUserId === normalizedNewOwnerId) {
    throw new ServiceError(
      'O usuário informado já é o proprietário do documento.',
      'DOCUMENT_OWNER_UNCHANGED',
      409,
    );
  }

  const targetMember = await findActiveTenantMemberUserId(ctx.tenantId, normalizedNewOwnerId);
  if (!targetMember) {
    throw new ServiceError(
      'Usuário de destino não encontrado ou inativo neste tenant.',
      'NEW_OWNER_NOT_FOUND',
      404,
    );
  }

  const resolvedNewOwnerUserId = resolveMemberUserId(targetMember);
  const newOwnerName = await resolveDocumentOwnerName({
    tenantId: ctx.tenantId,
    ownerUserId: resolvedNewOwnerUserId,
  });

  const actor = await resolveDocumentActorIdentity({ tenantId: ctx.tenantId, actor: user });
  const mutationFields = buildDocumentMutationFields({
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
  });

  const record = mongoDoc as Record<string, unknown>;
  const previousOwnerName =
    (record.ownerName as string | undefined)?.trim() ||
    (await resolveDocumentOwnerName({
      tenantId: ctx.tenantId,
      ownerUserId: currentOwnerUserId,
    }));

  await documents.updateOne(
    {
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
      ...ACTIVE_DOCUMENT_FILTER,
    } as Record<string, unknown>,
    {
      $set: {
        ownerUserId: resolvedNewOwnerUserId,
        ownerName: newOwnerName,
        ...mutationFields,
        ...(reason?.trim() ? { ownershipTransferReason: reason.trim() } : {}),
      },
    },
  );

  return {
    documentId,
    previousOwnerUserId: currentOwnerUserId,
    previousOwnerName,
    newOwnerUserId: resolvedNewOwnerUserId,
    newOwnerName,
    transferredAt: mutationFields.updatedAt.toISOString(),
  };
}

export function canTransferDocumentOwnership(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId'>,
): boolean {
  if (isDocumentAdmin(user)) return true;
  return Boolean(doc.ownerUserId && doc.ownerUserId === user.id);
}
