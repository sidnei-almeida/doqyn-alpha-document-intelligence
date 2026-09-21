import { randomUUID } from 'node:crypto';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import type { MongoDocumentUploadApproval } from '../db/types.js';
import type { AuthUser } from '../auth/types.js';
import { isDocumentAdmin, loadDocumentAccessContext } from '../tenancy/documentAccess.js';
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
import { assertCanSubmitToCategory } from './categoryUploadPermission.js';
import { resolveAutoCreatedCategoryId } from './categoryAutoCreateService.js';
import { isUncategorizedCategory } from '../../shared/systemCategory.js';
import { resolveRequestForFulfillment } from './requests/documentRequestService.js';

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

export async function submitDocumentUploadForApproval(input: {
  payload: ConfirmAnalysisInput;
  user: AuthUser;
  ctx: DocumentRequestContext;
}): Promise<{ approvalId: string; status: 'pending' }> {
  const data = confirmAnalysisSchema.parse(input.payload);
  const tenantId = input.ctx.tenantId;

  /**
   * A categoria efetiva, na mesma ordem do confirm: pedido > escolha humana > IA.
   *
   * Este caminho olhava só para a classe da IA, e com isso o resgate manual — que existe
   * justamente para o documento que a IA não classificou — não funcionava para quem depende de
   * aprovação: a pessoa escolhia a categoria na revisão e recebia "Classificação inválida". Um
   * envio que cumpre pedido cai no mesmo buraco, e nele a escolha nem é de quem envia.
   *
   * O par desta decisão está em `confirmAnalysisService`; mudar uma sem a outra faz o envio
   * aprovado cair em categoria diferente da que a revisão mostrou.
   */
  const fulfilledRequest = data.documentRequestId?.trim()
    ? await resolveRequestForFulfillment(tenantId, input.ctx.userId, data.documentRequestId.trim())
    : null;

  /**
   * Em `auto_create`, quem envia não escolhe pasta — a IA propôs uma e o tenant já disse que
   * aceita. A pasta nasce aqui, e não só na aprovação, porque o registro de aprovação precisa de
   * categoria para rotear a governança: sem ela o aprovador não é encontrado.
   *
   * O par desta chamada está em `confirmAnalysisService`, com o mesmo `resolveAutoCreatedCategoryId`.
   * Separar os dois faria o envio aprovado cair em categoria diferente da que a revisão mostrou.
   */
  // "Sem categoria" é destino de fracasso, não classificação: com ela contando como classe, o
  // envio em `auto_create` pulava a criação e ia parar na pasta genérica. Mesma regra do par em
  // `confirmAnalysisService`.
  const aiClassId =
    data.classification.classId &&
    !isUncategorizedCategory({
      id: data.classification.classId,
      name: data.classification.className,
    })
      ? data.classification.classId
      : null;

  const autoCreatedClassId =
    fulfilledRequest?.categoryId || data.manualClassId?.trim() || aiClassId
      ? undefined
      : await resolveAutoCreatedCategoryId({
          tenantId,
          userId: input.ctx.userId,
          suggestion: data.classification.suggestedCategory,
          requestId: input.ctx.requestId,
        });

  const effectiveClassId =
    fulfilledRequest?.categoryId ?? data.manualClassId?.trim() ?? aiClassId ?? autoCreatedClassId;

  if (!effectiveClassId) {
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
    classId: effectiveClassId,
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

  /**
   * Cumprir um pedido dispensa a permissão de envio na categoria de destino.
   *
   * **Pedir é o ato de autorização.** Quem pediu escolheu a categoria e, ao pedir, autorizou aquele
   * documento a entrar ali. Exigir que o remetente também alcance a categoria mataria o caso que
   * originou a funcionalidade: o RH pede o comprovante ao funcionário, e o funcionário não tem — nem
   * deve ter — permissão de enviar na categoria do RH.
   *
   * O que não se dispensa é o resto: a categoria continua sendo a do pedido, o pedido tem de ser
   * dele e estar aberto (`resolveRequestForFulfillment` já recusou o contrário), e o envio segue
   * para a mesma fila de aprovação.
   */
  if (!fulfilledRequest) {
    assertCanSubmitToCategory({
      user: input.user,
      classId: effectiveClassId,
      updateGroupIds,
      memberGroupIds: accessCtx.memberGroupIds,
      governanceIndex: accessCtx.governanceIndex,
    });
  }

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
    classId: effectiveClassId,
    className: classAndRule.docClass.name,
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
