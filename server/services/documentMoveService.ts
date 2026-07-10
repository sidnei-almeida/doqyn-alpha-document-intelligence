import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentCategory } from '../db/types.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import {
  assertCanUpdateDocument,
  loadDocumentAccessContext,
  resolveDocumentPermissions,
} from '../tenancy/documentAccess.js';
import type { GovernanceAccessIndex } from '../tenancy/governanceAccessIndex.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { assertDocumentCategoryExists } from './documentCategoriesService.js';
import { updateDocumentChunksCategory } from './documentChunkService.js';
import {
  buildDocumentMutationFields,
  resolveDocumentActorIdentity,
} from '../utils/documentMutationFields.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
};

export type MoveDocumentResult = {
  documentId: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  code?: string;
  oldClassId?: string;
  oldCategoryName?: string;
  newClassId?: string;
  newCategoryName?: string;
  currentVersionId?: string;
};

export type BatchMoveDocumentsResult = {
  ok: boolean;
  moved: number;
  skipped: Array<{ documentId: string; reason: string }>;
  failed: Array<{ documentId: string; error: string; code?: string }>;
  targetClassId: string;
  targetCategoryName: string;
  results: MoveDocumentResult[];
};

async function loadActiveDocumentOrThrow(
  documentId: string,
  ctx: DocumentRequestContext,
): Promise<{ doc: MongoDocument; memberGroupIds: string[]; governanceIndex: GovernanceAccessIndex }> {
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

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  return { doc: doc as MongoDocument, memberGroupIds, governanceIndex };
}

async function resolveTargetCategory(
  tenantId: string,
  targetClassId: string,
  userId: string,
): Promise<MongoDocumentCategory> {
  const category = await assertDocumentCategoryExists(tenantId, targetClassId, {
    ownerUserId: userId,
  });

  if (!category.active) {
    throw new ServiceError(
      'A categoria de destino está inativa.',
      'CATEGORY_INACTIVE',
      400,
    );
  }

  return category;
}

export async function moveDocumentToCategory(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  targetClassId: string,
  reason?: string,
): Promise<MoveDocumentResult> {
  if (!targetClassId?.trim()) {
    throw new ServiceError('targetClassId é obrigatório.', 'MISSING_TARGET_CLASS', 400);
  }

  const normalizedTargetId = targetClassId.trim();

  if (!isMongoNativeConfigured()) {
    return {
      documentId,
      ok: true,
      oldClassId: 'cat_juridico',
      oldCategoryName: 'Jurídico',
      newClassId: normalizedTargetId,
      newCategoryName: 'Simulado',
      currentVersionId: 'sim-version',
      skipped: false,
    };
  }

  const { doc, memberGroupIds, governanceIndex } = await loadActiveDocumentOrThrow(documentId, ctx);

  if (doc.deletedAt) {
    throw new ServiceError(
      'Documentos na lixeira não podem ser movidos.',
      'DOCUMENT_TRASHED',
      409,
    );
  }

  const permissions = resolveDocumentPermissions(user, doc, memberGroupIds, governanceIndex);
  assertCanUpdateDocument(permissions);

  const targetCategory = await resolveTargetCategory(
    ctx.tenantId,
    normalizedTargetId,
    ctx.userId,
  );

  if (doc.classId === targetCategory._id) {
    return {
      documentId,
      ok: true,
      skipped: true,
      reason: 'already_in_category',
      oldClassId: doc.classId,
      oldCategoryName: doc.className,
      newClassId: targetCategory._id,
      newCategoryName: targetCategory.name,
      currentVersionId: doc.currentVersionId,
    };
  }

  const now = new Date();
  const actor = await resolveDocumentActorIdentity({ tenantId: ctx.tenantId, actor: user });
  const mutationFields = buildDocumentMutationFields({
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    now,
  });
  const docRecord = doc as Record<string, unknown>;
  const aiSuggestedClassId =
    (docRecord.aiSuggestedClassId as string | undefined) ?? doc.classId;

  const { documents, documentVersions, storage } = await getTenantCollections(ctx.tenantId, {
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
        classId: targetCategory._id,
        className: targetCategory.name,
        categorySlug: targetCategory.slug,
        previousClassId: doc.classId,
        previousCategoryName: doc.className,
        lastClassificationSource: 'manual_move',
        lastManualCategoryId: targetCategory._id,
        classificationSource: 'manual',
        aiSuggestedClassId,
        manualClassificationOverride: true,
        manualClassificationUpdatedAt: now,
        manualClassificationUpdatedBy: ctx.userId,
        movedAt: now,
        movedBy: ctx.userId,
        ...mutationFields,
        ...(reason?.trim() ? { movedReason: reason.trim() } : {}),
      },
    },
  );

  if (doc.currentVersionId) {
    await documentVersions.updateOne(
      {
        _id: doc.currentVersionId,
        documentId,
        ...tenantScopeFilterFromContext(storage),
      } as Record<string, unknown>,
      {
        $set: {
          'classification.classId': targetCategory._id,
          'classification.className': targetCategory.name,
        },
      },
    );
  }

  await updateDocumentChunksCategory({
    ctx,
    documentId,
    categoryId: targetCategory._id,
  });

  return {
    documentId,
    ok: true,
    oldClassId: doc.classId,
    oldCategoryName: doc.className,
    newClassId: targetCategory._id,
    newCategoryName: targetCategory.name,
    currentVersionId: doc.currentVersionId,
  };
}

async function runBatch(
  documentIds: string[],
  handler: (documentId: string) => Promise<MoveDocumentResult>,
): Promise<BatchMoveDocumentsResult> {
  const results: MoveDocumentResult[] = [];
  const skipped: Array<{ documentId: string; reason: string }> = [];
  const failed: Array<{ documentId: string; error: string; code?: string }> = [];

  for (const documentId of documentIds) {
    try {
      const result = await handler(documentId);
      results.push(result);
      if (result.skipped) {
        skipped.push({
          documentId,
          reason: result.reason ?? 'skipped',
        });
      }
    } catch (error) {
      const message =
        error instanceof ServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Falha ao mover documento.';
      const code = error instanceof ServiceError ? error.code : undefined;
      failed.push({ documentId, error: message, code });
      results.push({ documentId, ok: false, error: message, code });
    }
  }

  const moved = results.filter((r) => r.ok && !r.skipped).length;
  const firstSuccess = results.find((r) => r.ok && r.newClassId);

  return {
    ok: failed.length === 0,
    moved,
    skipped,
    failed,
    targetClassId: firstSuccess?.newClassId ?? '',
    targetCategoryName: firstSuccess?.newCategoryName ?? '',
    results,
  };
}

export async function batchMoveDocumentsToCategory(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentIds: string[],
  targetClassId: string,
  reason?: string,
): Promise<BatchMoveDocumentsResult> {
  if (!targetClassId?.trim()) {
    throw new ServiceError('targetClassId é obrigatório.', 'MISSING_TARGET_CLASS', 400);
  }

  const targetCategory = await resolveTargetCategory(
    ctx.tenantId,
    targetClassId.trim(),
    ctx.userId,
  );

  const batch = await runBatch(documentIds, (documentId) =>
    moveDocumentToCategory(ctx, user, documentId, targetClassId, reason),
  );

  return {
    ...batch,
    targetClassId: targetCategory._id,
    targetCategoryName: targetCategory.name,
  };
}
