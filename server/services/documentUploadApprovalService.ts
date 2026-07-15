import { randomUUID } from 'node:crypto';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import type { MongoDocumentUploadApproval } from '../db/types.js';
import type { AuthUser } from '../auth/types.js';
import { isDocumentAdmin, loadDocumentAccessContext, userHasDocumentGroupAccess } from '../tenancy/documentAccess.js';
import { userHasGovernanceCategoryPermission } from '../tenancy/governanceAccessIndex.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { resolveCategoryAccessGroupIds } from './documentAccessRulesService.js';
import { getMongoClassAndRule } from './documentRulesService.js';
import {
  confirmAnalysisPersistence,
  confirmAnalysisSchema,
  ConfirmAnalysisError,
  type ConfirmAnalysisInput,
} from './confirmAnalysisService.js';
import { ServiceError } from '../utils/serviceErrors.js';

function uploadApprovalsCollection() {
  return getDb().then((db) =>
    db.collection<MongoDocumentUploadApproval>(SHARED_APP_COLLECTIONS.documentUploadApprovals),
  );
}

function resolveSubmitterDisplayName(user: AuthUser): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.name?.trim() || user.email;
}

function assertCanSubmitUpload(input: {
  user: AuthUser;
  classId: string;
  updateGroupIds: string[];
  memberGroupIds: string[];
  governanceIndex: Awaited<ReturnType<typeof loadDocumentAccessContext>>['governanceIndex'];
}): void {
  if (isDocumentAdmin(input.user)) return;

  if (!input.updateGroupIds.length) return;

  if (userHasDocumentGroupAccess(input.updateGroupIds, input.memberGroupIds)) return;

  if (
    userHasGovernanceCategoryPermission(
      input.governanceIndex,
      input.classId,
      input.memberGroupIds,
      'upload',
    )
  ) {
    return;
  }

  throw new ServiceError(
    'Você não tem permissão para enviar documentos nesta categoria.',
    'DOCUMENT_UPLOAD_DENIED',
    403,
  );
}

export async function submitDocumentUploadForApproval(input: {
  payload: ConfirmAnalysisInput;
  user: AuthUser;
  ctx: DocumentRequestContext;
}): Promise<{ approvalId: string; status: 'pending' }> {
  const data = confirmAnalysisSchema.parse(input.payload);
  const tenantId = input.ctx.tenantId;

  if (!data.classification.classId) {
    throw new ConfirmAnalysisError(
      'Classificação inválida. Não é possível enviar sem uma classe identificada.',
      'INVALID_CLASSIFICATION',
      400,
    );
  }

  if (isDocumentAdmin(input.user)) {
    throw new ServiceError(
      'Administradores confirmam metadados diretamente, sem enviar para aprovação.',
      'ADMIN_DIRECT_CONFIRM',
      400,
    );
  }

  const classAndRule = await getMongoClassAndRule({
    companyId: tenantId,
    classId: data.classification.classId,
    ownerUserId: input.ctx.userId,
  });

  if (!classAndRule) {
    throw new ConfirmAnalysisError(
      'Classe ou regra ativa não encontrada no sistema.',
      'CLASS_OR_RULE_NOT_FOUND',
      404,
    );
  }

  const categoryAccess = await resolveCategoryAccessGroupIds(tenantId, classAndRule.docClass._id, {
    ownerUserId: input.ctx.userId,
  });

  const updateGroupIds = categoryAccess.updateGroupIds;

  const accessCtx = await loadDocumentAccessContext({
    tenantId,
    userId: input.ctx.userId,
    membershipId: input.ctx.membershipId,
  });

  assertCanSubmitUpload({
    user: input.user,
    classId: data.classification.classId,
    updateGroupIds,
    memberGroupIds: accessCtx.memberGroupIds,
    governanceIndex: accessCtx.governanceIndex,
  });

  const collection = await uploadApprovalsCollection();
  const existingPending = await collection.findOne({
    tenantId,
    status: 'pending',
    fileHash: data.fileHash,
    'submittedBy.userId': input.ctx.userId,
  });

  if (existingPending) {
    return { approvalId: existingPending._id, status: 'pending' };
  }

  const now = new Date();
  const approvalId = `upl_${randomUUID()}`;

  const record: MongoDocumentUploadApproval = {
    _id: approvalId,
    tenantId,
    status: 'pending',
    submittedBy: {
      userId: input.ctx.userId,
      membershipId: input.ctx.membershipId,
      name: resolveSubmitterDisplayName(input.user),
      email: input.user.email,
    },
    payload: data as unknown as Record<string, unknown>,
    originalFileName: data.originalFileName,
    classId: data.classification.classId,
    className: data.classification.className ?? classAndRule.docClass.name,
    fileHash: data.fileHash,
    jobId: data.jobId,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(record);

  return { approvalId, status: 'pending' };
}

export async function listPendingDocumentUploadApprovals(input: {
  tenantId: string;
  user: AuthUser;
}): Promise<MongoDocumentUploadApproval[]> {
  if (!isDocumentAdmin(input.user)) {
    throw new ServiceError(
      'Apenas administradores podem consultar envios pendentes.',
      'FORBIDDEN',
      403,
    );
  }

  const collection = await uploadApprovalsCollection();
  return collection
    .find({ tenantId: input.tenantId, status: 'pending' })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function approveDocumentUploadApproval(input: {
  approvalId: string;
  user: AuthUser;
  ctx: DocumentRequestContext;
  requestId?: string;
}): Promise<{
  documentId: string;
  versionId: string;
  status: 'saved';
  documentCode: string;
  storageStatus: 'stored' | 'pending';
  approvalId: string;
}> {
  if (!isDocumentAdmin(input.user)) {
    throw new ServiceError(
      'Apenas administradores podem aprovar envios de documentos.',
      'FORBIDDEN',
      403,
    );
  }

  const collection = await uploadApprovalsCollection();
  const approval = await collection.findOne({
    _id: input.approvalId,
    tenantId: input.ctx.tenantId,
    status: 'pending',
  });

  if (!approval) {
    throw new ServiceError('Envio pendente não encontrado.', 'UPLOAD_APPROVAL_NOT_FOUND', 404);
  }

  const payload = confirmAnalysisSchema.parse(approval.payload);

  const result = await confirmAnalysisPersistence({
    payload: {
      ...payload,
      manualReviewConfirmed: true,
    },
    user: input.user,
    ctx: input.ctx,
    requestId: input.requestId,
    documentOwnerUserId: approval.submittedBy.userId,
    documentOwnerDisplayName: approval.submittedBy.name,
    skipConfirmPermissionCheck: true,
  });

  const now = new Date();
  await collection.updateOne(
    { _id: approval._id },
    {
      $set: {
        status: 'approved',
        documentId: result.documentId,
        versionId: result.versionId,
        reviewedBy: input.user.id,
        reviewedAt: now,
        updatedAt: now,
      },
    },
  );

  return { ...result, approvalId: approval._id };
}

export async function rejectDocumentUploadApproval(input: {
  approvalId: string;
  user: AuthUser;
  ctx: DocumentRequestContext;
  reason?: string;
}): Promise<{ approvalId: string; status: 'rejected' }> {
  if (!isDocumentAdmin(input.user)) {
    throw new ServiceError(
      'Apenas administradores podem rejeitar envios de documentos.',
      'FORBIDDEN',
      403,
    );
  }

  const collection = await uploadApprovalsCollection();
  const approval = await collection.findOne({
    _id: input.approvalId,
    tenantId: input.ctx.tenantId,
    status: 'pending',
  });

  if (!approval) {
    throw new ServiceError('Envio pendente não encontrado.', 'UPLOAD_APPROVAL_NOT_FOUND', 404);
  }

  const now = new Date();
  await collection.updateOne(
    { _id: approval._id },
    {
      $set: {
        status: 'rejected',
        reviewedBy: input.user.id,
        reviewedAt: now,
        rejectionReason: input.reason?.trim() || 'Rejeitado pelo administrador.',
        updatedAt: now,
      },
    },
  );

  return { approvalId: approval._id, status: 'rejected' };
}
