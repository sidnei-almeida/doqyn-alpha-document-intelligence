import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoUserDocumentFavorite } from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import { loadDocumentAccessContext } from '../../tenancy/documentAccess.js';
import { canUserListDocumentWithShare } from '../../tenancy/documentShareAccess.js';
import {
  findActiveShareGrantForUser,
  findActiveShareGrantsForUser,
} from '../sharing/documentShareService.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import type { TenantStorageContext } from '../../tenancy/tenantStorage.js';
import { buildDocumentListItems } from '../documentListItems.js';
import type { MongoDocument } from '../../db/types.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { isForeignScope, resolveDocumentReadScope } from '../../tenancy/documentReadScope.js';

type FavoriteLookupResult = {
  activeIds: Set<string>;
};

function activeFavoriteFilter(userId: string, documentIds?: string[]) {
  const filter: Record<string, unknown> = {
    userId,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  };
  if (documentIds?.length) {
    filter.documentId = { $in: documentIds };
  }
  return filter;
}

async function getFavoritesCollection(): Promise<Collection<MongoUserDocumentFavorite>> {
  const db = await getDb();
  return db.collection<MongoUserDocumentFavorite>(SHARED_APP_COLLECTIONS.userDocumentFavorites);
}

export async function findFavoriteDocumentIdsForUser(
  userId: string,
  documentIds?: string[],
): Promise<Set<string>> {
  if (!isMongoNativeConfigured() || !userId) return new Set();

  const collection = await getFavoritesCollection();
  const favorites = await collection
    .find(activeFavoriteFilter(userId, documentIds), { projection: { documentId: 1 } })
    .toArray();

  return new Set(favorites.map((favorite) => favorite.documentId));
}

async function loadAccessibleDocument(
  documentId: string,
  storage: TenantStorageContext,
  tenantId: string,
  user: AuthUser,
  membershipId?: string,
) {
  // Documento de outra empresa também pode ser favoritado: o favorito é uma marca de quem lê,
  // guardada no tenant dele, e não toca o acervo de origem.
  const scope = await resolveDocumentReadScope({
    tenantId,
    ownerUserId: user.id,
    documentId,
    userId: user.id,
  });

  const foreign = isForeignScope(scope);

  const collections = await getTenantCollections(scope.tenantId, {
    userId: scope.ownerUserId,
    membershipId: foreign ? undefined : membershipId,
  });

  const doc = await collections.documents.findOne({
    _id: documentId,
    // O escopo do documento de fora é o do acervo dele, não o de quem lê: filtrar pelo `storage`
    // da sessão procuraria o documento na prateleira errada e devolveria "não encontrado".
    ...tenantScopeFilterFromContext(foreign ? collections.storage : storage),
    deletedAt: { $in: [null, undefined] },
    permanentlyDeletedAt: { $in: [null, undefined] },
    deactivatedAt: { $in: [null, undefined] },
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  // A concessão aceita já é a autorização, e a governança de quem lê não alcança este documento.
  if (foreign) {
    return { doc: doc as MongoDocument, memberGroupIds: [] as string[] };
  }

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId,
    userId: user.id,
    membershipId,
  });

  const shareGrant = await findActiveShareGrantForUser(documentId, user.id);

  if (
    !canUserListDocumentWithShare(
      user,
      doc as MongoDocument,
      memberGroupIds,
      shareGrant,
      governanceIndex,
    )
  ) {
    throw new ServiceError(
      'Você não tem permissão para favoritar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }

  return { doc: doc as MongoDocument, memberGroupIds };
}

export async function addDocumentFavorite(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const { doc } = await loadAccessibleDocument(
    documentId,
    ctx.storage,
    ctx.tenantId,
    user,
    ctx.membershipId,
  );

  const now = new Date();
  const collection = await getFavoritesCollection();

  await collection.updateOne(
    { userId: ctx.userId, documentId },
    {
      $set: {
        userId: ctx.userId,
        documentId,
        tenantId: ctx.storage.tenantId,
        documentTenantType: ctx.storage.tenantType,
        documentClassId: doc.classId,
        versionId: doc.currentVersionId,
        updatedAt: now,
        deletedAt: null,
      },
      $setOnInsert: {
        _id: `fav_${randomUUID()}`,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return { ok: true as const, documentId, isFavorite: true as const };
}

export async function removeDocumentFavorite(ctx: DocumentRequestContext, documentId: string) {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const collection = await getFavoritesCollection();
  const now = new Date();

  await collection.updateOne(
    {
      userId: ctx.userId,
      documentId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    },
    { $set: { deletedAt: now, updatedAt: now } },
  );

  return { ok: true as const, documentId, isFavorite: false as const };
}

async function resolveFavoriteDocuments(
  favorites: MongoUserDocumentFavorite[],
  user: AuthUser,
  membershipId?: string,
  excludeArchived = true,
): Promise<Awaited<ReturnType<typeof buildDocumentListItems>>> {
  if (!favorites.length) return [];

  const grouped = new Map<string, MongoUserDocumentFavorite[]>();
  for (const favorite of favorites) {
    const tenantId = favorite.tenantId;
    if (!tenantId) continue;
    const bucket = grouped.get(tenantId) ?? [];
    bucket.push(favorite);
    grouped.set(tenantId, bucket);
  }

  const favoriteOrder = new Map(
    favorites.map((favorite, index) => [favorite.documentId, index] as const),
  );

  const resolved: Array<
    Awaited<ReturnType<typeof buildDocumentListItems>>[number] & { isFavorite: boolean }
  > = [];

  for (const [tenantId, tenantFavorites] of grouped) {
    const { documents, storage } = await getTenantCollections(tenantId, {
      userId: user.id,
      membershipId,
    });

    const documentIds = tenantFavorites.map((favorite) => favorite.documentId);
    const docs = await documents
      .find({
        _id: { $in: documentIds },
        ...tenantScopeFilterFromContext(storage),
        deletedAt: { $in: [null, undefined] },
        permanentlyDeletedAt: { $in: [null, undefined] },
        deactivatedAt: { $in: [null, undefined] },
        ...(excludeArchived ? { status: { $ne: 'archived' } } : {}),
      } as Record<string, unknown>)
      .toArray();

    const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
      tenantId,
      userId: user.id,
      membershipId,
    });

    const shareGrants = await findActiveShareGrantsForUser(user.id, tenantId);
    const shareGrantsByDocumentId = new Map(
      shareGrants.map((grant) => [grant.documentId, grant] as const),
    );

    const visibleDocs = docs.filter((doc) =>
      canUserListDocumentWithShare(
        user,
        doc as MongoDocument,
        memberGroupIds,
        shareGrantsByDocumentId.get(String(doc._id)),
        governanceIndex,
      ),
    );

    const items = await buildDocumentListItems({
      tenantId,
      docs: visibleDocs as MongoDocument[],
      user,
      ownerUserId: user.id,
      membershipId,
      memberGroupIds,
      shareGrantsByDocumentId,
    });

    for (const item of items) {
      resolved.push({ ...item, isFavorite: true });
    }
  }

  resolved.sort(
    (a, b) => (favoriteOrder.get(a.documentId) ?? 0) - (favoriteOrder.get(b.documentId) ?? 0),
  );

  return resolved;
}

export async function listFavoriteDocuments(
  user: AuthUser,
  membershipId?: string,
  options?: { excludeArchived?: boolean },
) {
  if (!isMongoNativeConfigured() || !user.id) {
    return { items: [], documents: [], total: 0, pagination: { nextCursor: null } };
  }

  const collection = await getFavoritesCollection();
  const favorites = await collection
    .find(activeFavoriteFilter(user.id))
    .sort({ createdAt: -1 })
    .toArray();

  const items = await resolveFavoriteDocuments(
    favorites,
    user,
    membershipId,
    options?.excludeArchived !== false,
  );

  return {
    items,
    documents: items,
    total: items.length,
    pagination: { nextCursor: null },
  };
}

export async function lookupFavoriteFlags(
  userId: string | undefined,
  documentIds: string[],
): Promise<FavoriteLookupResult> {
  if (!userId || !documentIds.length) {
    return { activeIds: new Set() };
  }

  const activeIds = await findFavoriteDocumentIdsForUser(userId, documentIds);
  return { activeIds };
}

export function attachFavoriteFlags<T extends { documentId: string }>(
  items: T[],
  activeIds: Set<string>,
): Array<T & { isFavorite: boolean }> {
  return items.map((item) => ({
    ...item,
    isFavorite: activeIds.has(item.documentId),
  }));
}
