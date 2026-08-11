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
  assertCanManageDeactivatedDocuments,
  canUserListDocument,
  loadDocumentAccessContext,
  loadMemberDocumentGroupIds,
} from '../../tenancy/documentAccess.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  buildDocumentMutationFields,
  resolveDocumentActorIdentity,
} from '../../utils/documentMutationFields.js';
import { buildDocumentListItems } from '../documentListItems.js';
import { escapeRegexLiteral } from '../../utils/documentListQuery.js';
import {
  attachFavoriteFlags,
  lookupFavoriteFlags,
} from '../favorites/documentFavoritesService.js';
import {
  computeTrashExpiresAt,
  getTrashRetentionSettings,
} from './trashRetentionSettings.js';
import { listActiveTenants } from '../tenantsService.js';
import { emitTrackingEvent } from '../tracking/trackingService.js';
import { sanitizeAuditMetadata } from '../../utils/sanitizeAuditMetadata.js';
import type { DocumentAuditContext } from '../../audit/documentAuditTypes.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

const TRASH_DOCUMENT_FILTER = {
  deletedAt: { $ne: null, $exists: true },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

const DEACTIVATED_DOCUMENT_FILTER = {
  lifecycleStatus: 'deactivated',
  deactivatedAt: { $ne: null, $exists: true },
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

export type DeactivatedDocumentListItem = Awaited<
  ReturnType<typeof buildDocumentListItems>
>[number] & {
  deactivatedAt?: string;
  deactivatedBy?: string | null;
  deactivatedReason?: string | null;
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

function mapDeactivatedFields(doc: MongoDocument) {
  return {
    deactivatedAt: doc.deactivatedAt ? new Date(doc.deactivatedAt).toISOString() : undefined,
    deactivatedBy: doc.deactivatedBy ?? null,
    deactivatedReason: doc.deactivatedReason ?? null,
    lifecycleStatus: doc.lifecycleStatus ?? 'deactivated',
  };
}

function isDeactivatedDocument(doc: MongoDocument): boolean {
  return Boolean(doc.deactivatedAt) || doc.lifecycleStatus === 'deactivated';
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

async function buildDeactivatedListResponse(
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

  const enriched: DeactivatedDocumentListItem[] = withFavorites.map((item, index) => ({
    ...item,
    ...mapDeactivatedFields(docs[index]!),
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
    const term = escapeRegexLiteral(filters.search);
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

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const visible = docs.filter((doc) =>
    canUserListDocument(user, doc as MongoDocument, memberGroupIds, governanceIndex),
  ) as MongoDocument[];

  return buildTrashListResponse(ctx, user, visible);
}

export async function listDeactivatedDocuments(
  ctx: DocumentRequestContext,
  user: AuthUser,
  filters?: { search?: string; limit?: number },
) {
  assertCanManageDeactivatedDocuments(user, ctx.storage);

  if (!isMongoNativeConfigured()) {
    return { items: [], documents: [], total: 0, pagination: { nextCursor: null } };
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    ...DEACTIVATED_DOCUMENT_FILTER,
  };

  if (filters?.search?.trim()) {
    const term = escapeRegexLiteral(filters.search);
    query.$or = [
      { title: { $regex: term, $options: 'i' } },
      { currentFileName: { $regex: term, $options: 'i' } },
      { className: { $regex: term, $options: 'i' } },
    ];
  }

  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 200);

  const docs = (await documents
    .find(query)
    .sort({ deactivatedAt: -1 })
    .limit(limit)
    .toArray()) as MongoDocument[];

  return buildDeactivatedListResponse(ctx, user, docs);
}

export async function moveDocumentToTrash(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  reason?: string,
) {
  const { doc, memberGroupIds } = await loadDocumentOrThrow(documentId, ctx);

  if (isDeactivatedDocument(doc)) {
    throw new ServiceError(
      'Documento está desativado. Use a seção Desativados para recuperar.',
      'DOCUMENT_DEACTIVATED',
      409,
    );
  }

  if (doc.deletedAt) {
    throw new ServiceError('Documento já está na lixeira.', 'DOCUMENT_ALREADY_TRASHED', 409);
  }

  assertCanTrashDocument(user, doc, memberGroupIds);

  const settings = await getTrashRetentionSettings(ctx.tenantId);
  const now = new Date();
  const actor = await resolveDocumentActorIdentity({ tenantId: ctx.tenantId, actor: user });
  const mutationFields = buildDocumentMutationFields({
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    now,
  });
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
        ...mutationFields,
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

  if (isDeactivatedDocument(doc)) {
    throw new ServiceError(
      'Documento está desativado. Use a recuperação de desativados.',
      'DOCUMENT_DEACTIVATED',
      409,
    );
  }

  if (!doc.deletedAt) {
    throw new ServiceError('Documento não está na lixeira.', 'DOCUMENT_NOT_TRASHED', 409);
  }

  if (doc.permanentlyDeletedAt) {
    throw new ServiceError('Documento foi excluído permanentemente.', 'DOCUMENT_PURGED', 410);
  }

  assertCanTrashDocument(user, doc, memberGroupIds);

  const now = new Date();
  const actor = await resolveDocumentActorIdentity({ tenantId: ctx.tenantId, actor: user });
  const mutationFields = buildDocumentMutationFields({
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    now,
  });
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
        ...mutationFields,
      },
    },
  );

  return {
    documentId,
    lifecycleStatus: 'active' as const,
    restoredAt: now.toISOString(),
  };
}

export async function reactivateDocument(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  assertCanManageDeactivatedDocuments(user, ctx.storage);

  const { doc } = await loadDocumentOrThrow(documentId, ctx);

  if (!isDeactivatedDocument(doc)) {
    throw new ServiceError(
      'Documento não está desativado.',
      'DOCUMENT_NOT_DEACTIVATED',
      409,
    );
  }

  const now = new Date();
  const actor = await resolveDocumentActorIdentity({ tenantId: ctx.tenantId, actor: user });
  const mutationFields = buildDocumentMutationFields({
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    now,
  });
  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  await documents.updateOne(
    {
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
      ...DEACTIVATED_DOCUMENT_FILTER,
    } as Record<string, unknown>,
    {
      $set: {
        deactivatedAt: null,
        deactivatedBy: null,
        deactivatedReason: null,
        deletedAt: null,
        deletedBy: null,
        deletedReason: null,
        trashExpiresAt: null,
        lifecycleStatus: 'active',
        status: 'active',
        ...mutationFields,
      },
    },
  );

  return {
    documentId,
    lifecycleStatus: 'active' as const,
    reactivatedAt: now.toISOString(),
  };
}

/**
 * Exclusão permanente descontinuada — use lixeira → desativados.
 * Storage/Mongo não são apagados pelo fluxo de produto.
 */
export async function permanentlyDeleteDocument(
  _ctx: DocumentRequestContext,
  _user: AuthUser,
  _documentId: string,
  _options?: { skipPermissionCheck?: boolean },
): Promise<never> {
  throw new ServiceError(
    'Exclusão permanente descontinuada. Após o prazo na lixeira o documento é desativado; administradores podem recuperá-lo em Desativados.',
    'PERMANENT_DELETE_DISABLED',
    410,
  );
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

export async function batchReactivateDocuments(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentIds: string[],
) {
  return runBatch(documentIds, (documentId) => reactivateDocument(ctx, user, documentId));
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

async function deactivateTrashDocument(
  tenantId: string,
  doc: MongoDocument,
  actorUserId: string,
): Promise<void> {
  const documentId = String(doc._id);
  const now = new Date();
  const { documents, storage } = await getTenantCollections(tenantId, {});

  await documents.updateOne(
    {
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
      ...TRASH_DOCUMENT_FILTER,
    } as Record<string, unknown>,
    {
      $set: {
        deactivatedAt: now,
        deactivatedBy: actorUserId,
        deactivatedReason: 'trash_expired',
        lifecycleStatus: 'deactivated',
        status: 'archived',
        deletedAt: null,
        deletedBy: null,
        deletedReason: null,
        trashExpiresAt: null,
        updatedAt: now,
        updatedBy: actorUserId,
      },
    },
  );
}

/**
 * Ao expirar o TTL da lixeira: desativa o documento (sem apagar R2/Mongo).
 * Mantém o nome histórico `purgeExpiredTrashDocuments` para o script npm.
 */
export async function deactivateExpiredTrashDocuments(input: {
  tenantId?: string;
  apply?: boolean;
}): Promise<{
  scanned: number;
  eligible: Array<{ tenantId: string; documentId: string; trashExpiresAt: string }>;
  deactivated: number;
  failed: number;
  dryRun: boolean;
}> {
  if (!isMongoNativeConfigured()) {
    return { scanned: 0, eligible: [], deactivated: 0, failed: 0, dryRun: !input.apply };
  }

  const tenantList = input.tenantId
    ? [{ tenantId: input.tenantId }]
    : (await listActiveTenants()).map((t) => ({ tenantId: t.tenantId }));
  const now = new Date();
  const eligible: Array<{ tenantId: string; documentId: string; trashExpiresAt: string }> = [];
  let deactivated = 0;
  let failed = 0;

  for (const { tenantId } of tenantList) {
    const { documents, storage } = await getTenantCollections(tenantId, {});
    const expired = await documents
      .find({
        ...tenantScopeFilterFromContext(storage),
        ...TRASH_DOCUMENT_FILTER,
        trashExpiresAt: { $ne: null, $lte: now },
      } as Record<string, unknown>)
      .toArray();

    for (const doc of expired) {
      eligible.push({
        tenantId,
        documentId: String(doc._id),
        trashExpiresAt: new Date(doc.trashExpiresAt as Date).toISOString(),
      });

      if (!input.apply) continue;

      try {
        const typed = doc as MongoDocument;
        const actorUserId = typed.deletedBy ?? typed.ownerUserId ?? 'system';
        await deactivateTrashDocument(tenantId, typed, actorUserId);

        const auditCtx: DocumentAuditContext = {
          tenantId,
          tenantType: typed.tenantType === 'individual' ? 'individual' : 'business',
          collectionPrefix: storage.collectionPrefix,
          ownerTenantId: storage.tenantId,
          ownerUserId: typed.ownerUserId,
          actorUserId: 'system',
          actorDisplayName: 'Sistema (retenção da lixeira)',
          actorRole: 'system',
        };
        await emitTrackingEvent(auditCtx, {
          action: 'document.deactivated',
          description: 'Documento desativado após expiração do prazo na lixeira.',
          documentId: String(typed._id),
          metadata: sanitizeAuditMetadata({
            source: 'trash_retention_job',
            reason: 'trash_expired',
            previousDeletedBy: typed.deletedBy ?? null,
          }),
        });

        deactivated += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return {
    scanned: eligible.length,
    eligible,
    deactivated,
    failed,
    dryRun: !input.apply,
  };
}

/** @deprecated Use deactivateExpiredTrashDocuments — retorna `purged` como alias de `deactivated`. */
export async function purgeExpiredTrashDocuments(input: {
  tenantId?: string;
  apply?: boolean;
}): Promise<{
  scanned: number;
  eligible: Array<{ tenantId: string; documentId: string; trashExpiresAt: string }>;
  purged: number;
  deactivated: number;
  failed: number;
  dryRun: boolean;
}> {
  const result = await deactivateExpiredTrashDocuments(input);
  return {
    ...result,
    purged: result.deactivated,
  };
}

export {
  ACTIVE_DOCUMENT_FILTER,
  TRASH_DOCUMENT_FILTER,
  DEACTIVATED_DOCUMENT_FILTER,
};
