import type { AuthUser } from '../../auth/types.js';
import { isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoDocument } from '../../db/types.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import {
  assertCanTrashDocument,
  assertCanPermanentDeleteDocument,
  canUserListDocument,
  loadMemberDocumentGroupIds,
} from '../../tenancy/documentAccess.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { buildDocumentListItems } from '../documentListItems.js';
import {
  attachFavoriteFlags,
  lookupFavoriteFlags,
} from '../favorites/documentFavoritesService.js';
import {
  computeTrashExpiresAt,
  getTrashRetentionSettings,
} from './trashRetentionSettings.js';
import { purgeAllDocumentVersionStorage } from './documentStoragePurgeService.js';
import { resolveTenantStorageScopeForTenant } from '../../tenancy/resolveTenantStorageScope.js';
import { getTenantById, listActiveTenants } from '../tenantsService.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
};

const TRASH_DOCUMENT_FILTER = {
  deletedAt: { $ne: null, $exists: true },
  permanentlyDeletedAt: { $in: [null, undefined] },
};

export type TrashDocumentListItem = Awaited<
  ReturnType<typeof buildDocumentListItems>
>[number] & {
  deletedAt?: string;
  deletedBy?: string | null;
  deletedReason?: string | null;
  trashExpiresAt?: string | null;
  lifecycleStatus?: string;
};

function mapTrashFields(doc: MongoDocument) {
  return {
    deletedAt: doc.deletedAt ? new Date(doc.deletedAt).toISOString() : undefined,
    deletedBy: doc.deletedBy ?? null,
    deletedReason: doc.deletedReason ?? null,
    trashExpiresAt: doc.trashExpiresAt ? new Date(doc.trashExpiresAt).toISOString() : null,
    lifecycleStatus: doc.lifecycleStatus ?? (doc.deletedAt ? 'trashed' : 'active'),
  };
}

async function loadDocumentOrThrow(
  documentId: string,
  ctx: DocumentRequestContext,
): Promise<{ doc: MongoDocument; memberGroupIds: string[] }> {
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

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  return { doc: doc as MongoDocument, memberGroupIds };
}

async function buildTrashListResponse(
  ctx: DocumentRequestContext,
  user: AuthUser,
  docs: MongoDocument[],
) {
  const items = await buildDocumentListItems({
    tenantId: ctx.tenantId,
    docs,
    user,
    ownerUserId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const { activeIds } = await lookupFavoriteFlags(
    ctx.userId,
    items.map((item) => item.documentId),
  );
  const withFavorites = attachFavoriteFlags(items, activeIds);

  const enriched: TrashDocumentListItem[] = withFavorites.map((item, index) => ({
    ...item,
    ...mapTrashFields(docs[index]!),
  }));

  return {
    items: enriched,
    documents: enriched,
    total: enriched.length,
    pagination: { nextCursor: null },
  };
}

export async function listTrashDocuments(
  ctx: DocumentRequestContext,
  user: AuthUser,
  filters?: { search?: string; limit?: number },
) {
  if (!isMongoNativeConfigured()) {
    return { items: [], documents: [], total: 0, pagination: { nextCursor: null } };
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    ...TRASH_DOCUMENT_FILTER,
  };

  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    query.$or = [
      { title: { $regex: term, $options: 'i' } },
      { currentFileName: { $regex: term, $options: 'i' } },
      { className: { $regex: term, $options: 'i' } },
    ];
  }

  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 200);

  const docs = await documents
    .find(query)
    .sort({ deletedAt: -1 })
    .limit(limit)
    .toArray();

  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const visible = docs.filter((doc) =>
    canUserListDocument(user, doc as MongoDocument, memberGroupIds),
  ) as MongoDocument[];

  return buildTrashListResponse(ctx, user, visible);
}

export async function moveDocumentToTrash(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  reason?: string,
) {
  const { doc, memberGroupIds } = await loadDocumentOrThrow(documentId, ctx);

  if (doc.deletedAt) {
    throw new ServiceError('Documento já está na lixeira.', 'DOCUMENT_ALREADY_TRASHED', 409);
  }

  assertCanTrashDocument(user, doc, memberGroupIds);

  const settings = await getTrashRetentionSettings(ctx.tenantId);
  const now = new Date();
  const trashExpiresAt = computeTrashExpiresAt(settings, now);

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  await documents.updateOne(
    {
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
      ...ACTIVE_DOCUMENT_FILTER,
    } as Record<string, unknown>,
    {
      $set: {
        deletedAt: now,
        deletedBy: ctx.userId,
        deletedReason: reason?.trim() || null,
        trashExpiresAt,
        lifecycleStatus: 'trashed',
        status: 'archived',
        updatedAt: now,
      },
    },
  );

  return {
    documentId,
    deletedAt: now.toISOString(),
    trashExpiresAt: trashExpiresAt?.toISOString() ?? null,
    lifecycleStatus: 'trashed' as const,
  };
}

export async function restoreDocumentFromTrash(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  const { doc, memberGroupIds } = await loadDocumentOrThrow(documentId, ctx);

  if (!doc.deletedAt) {
    throw new ServiceError('Documento não está na lixeira.', 'DOCUMENT_NOT_TRASHED', 409);
  }

  if (doc.permanentlyDeletedAt) {
    throw new ServiceError('Documento foi excluído permanentemente.', 'DOCUMENT_PURGED', 410);
  }

  assertCanTrashDocument(user, doc, memberGroupIds);

  const now = new Date();
  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  await documents.updateOne(
    {
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
      ...TRASH_DOCUMENT_FILTER,
    } as Record<string, unknown>,
    {
      $set: {
        deletedAt: null,
        deletedBy: null,
        deletedReason: null,
        trashExpiresAt: null,
        lifecycleStatus: 'active',
        status: 'active',
        updatedAt: now,
      },
    },
  );

  return {
    documentId,
    lifecycleStatus: 'active' as const,
    restoredAt: now.toISOString(),
  };
}

export async function permanentlyDeleteDocument(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  options?: { skipPermissionCheck?: boolean },
) {
  const { doc, memberGroupIds } = await loadDocumentOrThrow(documentId, ctx);

  if (!doc.deletedAt) {
    throw new ServiceError(
      'Somente documentos na lixeira podem ser excluídos permanentemente.',
      'DOCUMENT_NOT_TRASHED',
      409,
    );
  }

  if (doc.permanentlyDeletedAt) {
    throw new ServiceError('Documento já foi excluído permanentemente.', 'DOCUMENT_ALREADY_PURGED', 409);
  }

  if (!options?.skipPermissionCheck) {
    assertCanPermanentDeleteDocument(user, doc, memberGroupIds);
  }

  return executePermanentDocumentPurge(ctx, doc);
}

async function executePermanentDocumentPurge(
  ctx: DocumentRequestContext,
  doc: MongoDocument,
) {
  const documentId = String(doc._id);

  const { documents, documentVersions, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const versions = await documentVersions
    .find({
      documentId,
      ...tenantScopeFilterFromContext(storage),
    } as Record<string, unknown>)
    .toArray();

  const tenant = await getTenantById(ctx.tenantId);
  const storageScope = tenant
    ? await resolveTenantStorageScopeForTenant(tenant, doc.ownerUserId)
    : undefined;

  const purge = await purgeAllDocumentVersionStorage({
    tenantId: ctx.tenantId,
    versions,
    storageScope,
  });

  const now = new Date();
  const purgeStatus = purge.hasFailures ? ('failed' as const) : ('completed' as const);
  const lifecycleStatus = purge.hasFailures ? ('trashed' as const) : ('permanently_deleted' as const);

  await documents.updateOne(
    {
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
    } as Record<string, unknown>,
    {
      $set: {
        permanentlyDeletedAt: purge.hasFailures ? null : now,
        purgeStatus,
        lifecycleStatus: purge.hasFailures ? 'trashed' : 'permanently_deleted',
        updatedAt: now,
        ...(purge.hasFailures ? {} : { status: 'archived' }),
      },
    },
  );

  return {
    documentId,
    permanentlyDeletedAt: purge.hasFailures ? null : now.toISOString(),
    purgeStatus,
    lifecycleStatus,
    purgeResults: purge.results,
  };
}

type BatchResult = {
  documentId: string;
  ok: boolean;
  error?: string;
  code?: string;
};

async function runBatch<T>(
  documentIds: string[],
  handler: (documentId: string) => Promise<T>,
): Promise<{ results: BatchResult[]; succeeded: number; failed: number }> {
  const uniqueIds = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))];
  const results: BatchResult[] = [];

  for (const documentId of uniqueIds) {
    try {
      await handler(documentId);
      results.push({ documentId, ok: true });
    } catch (error) {
      if (error instanceof ServiceError) {
        results.push({ documentId, ok: false, error: error.message, code: error.code });
      } else {
        results.push({
          documentId,
          ok: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido.',
        });
      }
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}

export async function batchMoveDocumentsToTrash(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentIds: string[],
  reason?: string,
) {
  return runBatch(documentIds, (documentId) =>
    moveDocumentToTrash(ctx, user, documentId, reason),
  );
}

export async function batchRestoreDocumentsFromTrash(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentIds: string[],
) {
  return runBatch(documentIds, (documentId) =>
    restoreDocumentFromTrash(ctx, user, documentId),
  );
}

export async function batchPermanentlyDeleteDocuments(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentIds: string[],
) {
  return runBatch(documentIds, (documentId) =>
    permanentlyDeleteDocument(ctx, user, documentId),
  );
}

export async function purgeExpiredTrashDocuments(input: {
  tenantId?: string;
  apply?: boolean;
}): Promise<{
  scanned: number;
  eligible: Array<{ tenantId: string; documentId: string; trashExpiresAt: string }>;
  purged: number;
  failed: number;
  dryRun: boolean;
}> {
  if (!isMongoNativeConfigured()) {
    return { scanned: 0, eligible: [], purged: 0, failed: 0, dryRun: !input.apply };
  }

  const tenantList = input.tenantId
    ? [{ tenantId: input.tenantId }]
    : (await listActiveTenants()).map((t) => ({ tenantId: t.tenantId }));
  const now = new Date();
  const eligible: Array<{ tenantId: string; documentId: string; trashExpiresAt: string }> = [];
  let purged = 0;
  let failed = 0;

  for (const { tenantId } of tenantList) {
    const tenant = await getTenantById(tenantId);
    if (!tenant) continue;

    const collections = await getTenantCollections(tenantId, {});
    const { documents, storage } = collections;
    const expired = await documents
      .find({
        ...tenantScopeFilterFromContext(storage),
        ...TRASH_DOCUMENT_FILTER,
        trashExpiresAt: { $ne: null, $lte: now },
      } as Record<string, unknown>)
      .toArray();

    let storageScope: Awaited<ReturnType<typeof resolveTenantStorageScopeForTenant>> | undefined;
    try {
      storageScope = await resolveTenantStorageScopeForTenant(tenant, expired[0]?.ownerUserId);
    } catch {
      storageScope = undefined;
    }

    for (const doc of expired) {
      eligible.push({
        tenantId,
        documentId: String(doc._id),
        trashExpiresAt: new Date(doc.trashExpiresAt as Date).toISOString(),
      });

      if (!input.apply) continue;

      try {
        const scope =
          storageScope ??
          (await resolveTenantStorageScopeForTenant(tenant, doc.ownerUserId));
        const purgeCtx: DocumentRequestContext = {
          tenantId,
          userId: doc.deletedBy ?? doc.ownerUserId ?? 'system',
          tenantType: doc.tenantType ?? tenant.tenantType,
          storage,
          storageScope: scope,
          collections,
        };
        const result = await executePermanentDocumentPurge(purgeCtx, doc as MongoDocument);
        if (result.purgeStatus === 'completed') purged += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return {
    scanned: eligible.length,
    eligible,
    purged,
    failed,
    dryRun: !input.apply,
  };
}

export { ACTIVE_DOCUMENT_FILTER, TRASH_DOCUMENT_FILTER };
