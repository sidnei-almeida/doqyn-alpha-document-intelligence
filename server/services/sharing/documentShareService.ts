import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS, REGISTRY_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  DocumentSharePermissions,
  MongoDocument,
  MongoDocumentShareGrant,
  MongoTenantMember,
} from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import type { GovernanceAccessIndex } from '../../tenancy/governanceAccessIndex.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import {
  loadMemberDocumentGroupIds,
  isDocumentAdmin,
  loadDocumentAccessContext,
} from '../../tenancy/documentAccess.js';
import {
  canUserShareDocument,
  canUserListDocumentWithShare,
  resolveDocumentPermissionsWithShare,
} from '../../tenancy/documentShareAccess.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { buildDocumentListItems } from '../documentListItems.js';
import { attachFavoriteFlags, lookupFavoriteFlags } from '../favorites/documentFavoritesService.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { getTenantIdFromUser } from '../../auth/tenantContext.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

function defaultSharePermissions(input?: Partial<DocumentSharePermissions>): DocumentSharePermissions {
  return {
    canView: input?.canView !== false,
    canDownload: input?.canDownload === true,
    canShare: false,
  };
}

async function getShareGrantsCollection(): Promise<Collection<MongoDocumentShareGrant>> {
  const db = await getDb();
  return db.collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants);
}

function activeGrantFilter(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'active',
    ...extra,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
}

export async function findActiveShareGrantForUser(
  documentId: string,
  sharedWithUserId: string,
): Promise<MongoDocumentShareGrant | null> {
  if (!isMongoNativeConfigured() || !sharedWithUserId) return null;
  const collection = await getShareGrantsCollection();
  return collection.findOne(activeGrantFilter({ documentId, sharedWithUserId }) as Record<string, unknown>);
}

export async function findActiveShareGrantsForUser(
  sharedWithUserId: string,
  tenantId: string,
): Promise<MongoDocumentShareGrant[]> {
  if (!isMongoNativeConfigured()) return [];
  const collection = await getShareGrantsCollection();
  return collection
    .find(activeGrantFilter({ sharedWithUserId, tenantId }) as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findActiveShareGrantsForDocument(
  documentId: string,
): Promise<MongoDocumentShareGrant[]> {
  if (!isMongoNativeConfigured()) return [];
  const collection = await getShareGrantsCollection();
  return collection.find(activeGrantFilter({ documentId }) as Record<string, unknown>).sort({ createdAt: -1 }).toArray();
}

async function resolveActiveTenantMemberByUserId(
  tenantId: string,
  userId: string,
): Promise<MongoTenantMember | null> {
  await listOperationalTenantMembers(tenantId);

  const db = await getDb();
  const member =
    (await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
      tenantId,
      status: 'active',
      $or: [{ authUserId: userId }, { memberId: userId }],
    })) ?? null;

  return member;
}

async function loadShareableDocument(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
): Promise<{
  doc: MongoDocument;
  memberGroupIds: string[];
  governanceIndex: GovernanceAccessIndex;
}> {
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

  if (doc.deletedAt) {
    throw new ServiceError(
      'Documentos na lixeira não podem ser compartilhados.',
      'DOCUMENT_TRASHED',
      409,
    );
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  // O índice de governança é obrigatório aqui: sem ele o verbo `share` configurado pelo tenant não
  // é consultado e sobram apenas admin e dono, tornando a coluna do mapa de regras inerte.
  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });

  if (!canUserShareDocument(user, doc as MongoDocument, memberGroupIds, governanceIndex)) {
    throw new ServiceError(
      'Você não tem permissão para compartilhar este documento.',
      'DOCUMENT_SHARE_DENIED',
      403,
    );
  }

  return {
    doc: doc as MongoDocument,
    memberGroupIds,
    governanceIndex,
  };
}

export async function searchShareableTenantUsers(
  ctx: DocumentRequestContext,
  user: AuthUser,
  query?: string,
  documentId?: string,
) {
  const members = await listOperationalTenantMembers(ctx.tenantId);
  const active = members.filter((member) => member.status === 'active');

  const existingSharedIds = new Set<string>();
  if (documentId) {
    const grants = await findActiveShareGrantsForDocument(documentId);
    for (const grant of grants) {
      existingSharedIds.add(grant.sharedWithUserId);
    }
  }

  const q = query?.trim().toLowerCase() ?? '';
  const results = active
    .map(serializeTenantMember)
    .filter((member) => {
      const memberUserId = member.userId;
      if (!memberUserId || memberUserId === user.id) return false;
      if (!q) return true;
      const haystack = [member.name, member.email, member.firstName, member.lastName, member.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, 25)
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      alreadyShared: existingSharedIds.has(member.userId),
    }));

  return { users: results };
}

export async function listDocumentShareGrants(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  const { doc, memberGroupIds, governanceIndex } = await loadShareableDocument(
    ctx,
    user,
    documentId,
  );
  if (!canUserShareDocument(user, doc, memberGroupIds, governanceIndex)) {
    throw new ServiceError(
      'Você não tem permissão para ver compartilhamentos deste documento.',
      'DOCUMENT_SHARE_DENIED',
      403,
    );
  }

  const grants = await findActiveShareGrantsForDocument(documentId);
  const members = await listOperationalTenantMembers(ctx.tenantId);
  const memberByUserId = new Map<string, ReturnType<typeof serializeTenantMember>>();

  for (const member of members) {
    const serialized = serializeTenantMember(member);
    if (serialized.userId) memberByUserId.set(serialized.userId, serialized);
  }

  return {
    documentId,
    shares: grants.map((grant) => {
      const recipient = memberByUserId.get(grant.sharedWithUserId);
      return {
        shareId: grant._id,
        sharedWithUserId: grant.sharedWithUserId,
        sharedWithName: recipient?.name ?? grant.sharedWithUserId,
        sharedWithEmail: recipient?.email,
        permissions: grant.permissions,
        message: grant.message ?? null,
        createdAt: grant.createdAt.toISOString(),
        sharedByUserId: grant.sharedByUserId,
      };
    }),
  };
}

export async function createDocumentShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  input: {
    sharedWithUserId: string;
    permissions?: Partial<DocumentSharePermissions>;
    message?: string;
  },
) {
  const sharedWithUserId = input.sharedWithUserId?.trim();
  if (!sharedWithUserId) {
    throw new ServiceError('sharedWithUserId é obrigatório.', 'MISSING_SHARED_WITH_USER', 400);
  }

  if (sharedWithUserId === user.id) {
    throw new ServiceError('Você não pode compartilhar consigo mesmo.', 'SELF_SHARE_DENIED', 400);
  }

  const { doc } = await loadShareableDocument(ctx, user, documentId);

  const recipient = await resolveActiveTenantMemberByUserId(ctx.tenantId, sharedWithUserId);
  if (!recipient) {
    throw new ServiceError(
      'Usuário de destino não encontrado ou inativo neste ambiente.',
      'SHARE_RECIPIENT_INVALID',
      400,
    );
  }

  const permissions = defaultSharePermissions(input.permissions);
  if (!permissions.canView) {
    throw new ServiceError('canView é obrigatório para compartilhamento.', 'INVALID_SHARE_PERMISSIONS', 400);
  }

  const collection = await getShareGrantsCollection();
  const now = new Date();
  const existing = await collection.findOne(
    activeGrantFilter({ documentId, sharedWithUserId }) as Record<string, unknown>,
  );

  if (existing) {
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          permissions,
          message: input.message?.trim() || null,
          updatedAt: now,
        },
      },
    );
    return {
      shareId: existing._id,
      documentId,
      sharedWithUserId,
      permissions,
      updated: true,
      currentVersionId: doc.currentVersionId,
    };
  }

  const grant: MongoDocumentShareGrant = {
    _id: `share_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    documentId,
    tenantId: ctx.tenantId,
    documentTenantType: ctx.tenantType === 'individual' ? 'individual' : 'business',
    sharedByUserId: user.id,
    sharedWithUserId,
    permissions,
    status: 'active',
    message: input.message?.trim() || null,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    revokedBy: null,
    expiresAt: null,
  };

  await collection.insertOne(grant);

  return {
    shareId: grant._id,
    documentId,
    sharedWithUserId,
    permissions,
    updated: false,
    currentVersionId: doc.currentVersionId,
  };
}

export async function revokeDocumentShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  shareId: string,
) {
  const collection = await getShareGrantsCollection();
  const grant = await collection.findOne({ _id: shareId, documentId, status: 'active' });

  if (!grant) {
    throw new ServiceError('Compartilhamento não encontrado.', 'SHARE_NOT_FOUND', 404);
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });

  const canRevoke =
    isDocumentAdmin(user) ||
    grant.sharedByUserId === user.id ||
    (doc as MongoDocument).ownerUserId === user.id ||
    canUserShareDocument(user, doc as MongoDocument, memberGroupIds, governanceIndex);

  if (!canRevoke) {
    throw new ServiceError(
      'Você não tem permissão para revogar este compartilhamento.',
      'DOCUMENT_SHARE_REVOKE_DENIED',
      403,
    );
  }

  const now = new Date();
  await collection.updateOne(
    { _id: shareId },
    {
      $set: {
        status: 'revoked',
        revokedAt: now,
        revokedBy: user.id,
        updatedAt: now,
      },
    },
  );

  return {
    shareId,
    documentId,
    sharedWithUserId: grant.sharedWithUserId,
    revokedAt: now.toISOString(),
    currentVersionId: (doc as MongoDocument).currentVersionId,
  };
}

export async function listSharedWithMeDocuments(
  user: AuthUser,
  membershipId?: string,
  search?: string,
) {
  const tenantId = getTenantIdFromUser(user);

  if (!isMongoNativeConfigured()) {
    return { items: [], total: 0 };
  }

  const grants = await findActiveShareGrantsForUser(user.id, tenantId);
  if (!grants.length) {
    return { items: [], total: 0 };
  }

  const grantByDocumentId = new Map(grants.map((grant) => [grant.documentId, grant]));
  const documentIds = [...grantByDocumentId.keys()];

  const { documents, storage } = await getTenantCollections(tenantId, {
    userId: user.id,
    membershipId,
  });

  const docs = (await documents
    .find({
      _id: { $in: documentIds },
      ...tenantScopeFilterFromContext(storage),
      ...ACTIVE_DOCUMENT_FILTER,
    } as Record<string, unknown>)
    .toArray()) as MongoDocument[];

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId,
    userId: user.id,
    membershipId,
  });

  const memberLookup = new Map(
    (await listOperationalTenantMembers(tenantId)).map((member) => {
      const serialized = serializeTenantMember(member);
      return [serialized.userId, serialized.name] as const;
    }),
  );

  const accessibleDocs = docs.filter((doc) =>
    canUserListDocumentWithShare(
      user,
      doc,
      memberGroupIds,
      grantByDocumentId.get(String(doc._id)),
      governanceIndex,
    ),
  );

  let items = await buildDocumentListItems({
    tenantId,
    docs: accessibleDocs,
    user,
    ownerUserId: user.id,
    membershipId,
    memberGroupIds,
    shareGrantsByDocumentId: grantByDocumentId,
  });

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) => {
      const haystack = [
        item.currentFileName,
        item.displayName,
        item.categoryName,
        item.ownerName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const { activeIds } = await lookupFavoriteFlags(
    user.id,
    items.map((item) => item.documentId),
  );
  items = attachFavoriteFlags(items, activeIds);

  items = items.map((item) => {
    const grant = grantByDocumentId.get(item.documentId);
    if (!grant) return item;
    return {
      ...item,
      sharedWithMe: true,
      sharedByUserId: grant.sharedByUserId,
      sharedByNameSnapshot: memberLookup.get(grant.sharedByUserId) ?? grant.sharedByUserId,
      sharedAt: grant.createdAt.toISOString(),
      sharePermissions: grant.permissions,
    };
  });

  return { items, total: items.length };
}

export async function resolveDocumentAccessWithShare(input: {
  user: AuthUser;
  doc: MongoDocument;
  memberGroupIds?: string[];
  sharedWithUserId?: string;
  tenantId?: string;
  membershipId?: string;
  governanceIndex?: GovernanceAccessIndex;
}) {
  const shareGrant = input.sharedWithUserId
    ? await findActiveShareGrantForUser(String(input.doc._id), input.sharedWithUserId)
    : null;

  const accessContext =
    input.memberGroupIds && input.governanceIndex
      ? { memberGroupIds: input.memberGroupIds, governanceIndex: input.governanceIndex }
      : input.tenantId
        ? await loadDocumentAccessContext({
            tenantId: input.tenantId,
            userId: input.user.id,
            membershipId: input.membershipId,
          })
        : {
            memberGroupIds: input.memberGroupIds ?? [],
            governanceIndex: input.governanceIndex,
          };

  const memberGroupIds = accessContext.memberGroupIds ?? [];
  const governanceIndex = accessContext.governanceIndex;

  return {
    shareGrant,
    // Devolvidos para quem precisa decidir mais coisas sobre o mesmo documento — tracking, por
    // exemplo — sem recarregar grupos e regras do banco.
    memberGroupIds,
    governanceIndex,
    permissions: resolveDocumentPermissionsWithShare(
      input.user,
      input.doc,
      memberGroupIds,
      shareGrant,
      governanceIndex,
    ),
    canList: canUserListDocumentWithShare(
      input.user,
      input.doc,
      memberGroupIds,
      shareGrant,
      governanceIndex,
    ),
  };
}
