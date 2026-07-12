import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompanyIdFromUser } from '../../server/auth/companyContext.js';
import { canAnalyzeDocuments } from '../../server/auth/permissions.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import {
  buildDocumentRequestContext,
  resolveTenantStorageScopeFromAuthUser,
} from '../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { createDocumentAuditLog } from '../../server/audit/documentAuditLogService.js';
import { analyzePdfUpdateBuffer } from '../../server/ai/services/analyzePdfUpdateService.js';
import { AI_ERROR_MESSAGES } from '../../server/ai/constants.js';
import { isAiAnalysisError } from '../../server/ai/utils/errors.js';
import { parseAnalyzePdfRequest } from '../../server/utils/parseAnalyzePdfRequest.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';
import { isStorageConfigured, storeAnalysisStaging } from '../../server/storage/index.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { workflowErrorFromUnknown } from '../../server/utils/workflowErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';
import { buildAnalysisJobNameSnapshot } from '../../server/audit/documentNameSnapshot.js';
import { assertCanUpdateExistingDocument } from '../../server/services/documentVersionService.js';
import { assertTenantQuota } from '../../server/tenancy/tenantQuotas.js';
import { resolveAnalysisProviderName } from '../../server/ai/providers/resolveAnalysisProvider.js';
import {
  enqueuePdfAnalysisJob,
  enqueuePdfAnalysisJobFromStaging,
  isAsyncPdfAnalysisAvailable,
} from '../../server/services/analysis/enqueuePdfAnalysisJob.js';
import {
  readDocumentIdFromIngress,
  resolveAnalyzePdfIngress,
} from '../../server/services/analysis/analyzePdfIngress.js';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = extractRequestContext(req);
  const startedAt = Date.now();

  logger.info('analyze-pdf-update request started', {
    requestId: ctx.requestId,
    endpoint: '/api/ai/analyze-pdf-update',
    ...getBearerAuthLogFields(req),
  });

  const user = await requireAuth(req, res);
  if (!user) return;

  let auditCtx: ReturnType<typeof buildDocumentAuditContext> | null = null;

  if (!canAnalyzeDocuments(user)) {
    return res.status(403).json({ message: 'Sem permissão para analisar documentos.' });
  }

  try {
    const parsed = await parseAnalyzePdfRequest(req);
    const documentId = readDocumentIdFromIngress(parsed);

    if (!documentId) {
      return res.status(400).json({
        message: 'documentId é obrigatório para análise de atualização.',
        code: 'DOCUMENT_ID_REQUIRED',
      });
    }

    const companyId = getCompanyIdFromUser(user);
    const docCtx = await buildDocumentRequestContext(user);
    auditCtx = buildDocumentAuditContext(docCtx, user, ctx.requestId);
    const storageScope = resolveTenantStorageScopeFromAuthUser(user);

    const ingress = await resolveAnalyzePdfIngress(parsed, {
      tenantId: companyId,
      ownerUserId: user.id,
      storageScope,
      loadBuffer: !isAsyncPdfAnalysisAvailable(),
    });

    await assertTenantQuota(companyId, 'analysis_per_day');

    await assertCanUpdateExistingDocument({
      documentId,
      tenantId: companyId,
      ownerUserId: user.id,
      user,
      membershipId: docCtx.membershipId,
    });

    const aiProvider = resolveAnalysisProviderName();

    if (isAsyncPdfAnalysisAvailable()) {
      try {
        const queued =
          ingress.fromStaging && ingress.jobId
            ? await enqueuePdfAnalysisJobFromStaging({
                tenantId: companyId,
                ownerUserId: user.id,
                jobId: ingress.jobId,
                originalFileName: ingress.originalFileName,
                mimeType: ingress.mimeType,
                fileSizeBytes: ingress.fileSize,
                storageScope,
                requestId: ctx.requestId,
                batchId: ctx.batchId,
                itemId: ctx.itemId,
                jobKind: 'version_update',
                documentId,
                membershipId: docCtx.membershipId,
              })
            : await enqueuePdfAnalysisJob({
                tenantId: companyId,
                ownerUserId: user.id,
                buffer: parsed.mode === 'multipart' ? parsed.file.buffer : Buffer.alloc(0),
                originalFileName: ingress.originalFileName,
                mimeType: ingress.mimeType,
                storageScope,
                requestId: ctx.requestId,
                batchId: ctx.batchId,
                itemId: ctx.itemId,
                jobKind: 'version_update',
                documentId,
                membershipId: docCtx.membershipId,
              });

        logger.info('analyze-pdf-update enfileirado', {
          requestId: ctx.requestId,
          jobId: queued.jobId,
          documentId,
          tenantId: companyId,
          aiProvider,
          fromStaging: ingress.fromStaging,
          durationMs: Date.now() - startedAt,
        });

        res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
        return res.status(202).json(queued);
      } catch (queueError) {
        if (isServiceError(queueError)) {
          const { statusCode, body } = workflowErrorFromUnknown(queueError, {
            requestId: ctx.requestId,
            defaultCode: queueError.code,
          });
          return res.status(statusCode).json(body);
        }
        throw queueError;
      }
    }

    const fileBuffer = ingress.buffer;
    if (!fileBuffer) {
      return res.status(500).json({ message: AI_ERROR_MESSAGES.analysisFailed });
    }

    const result = await analyzePdfUpdateBuffer({
      buffer: fileBuffer,
      originalFileName: ingress.originalFileName,
      mimeType: ingress.mimeType,
      companyId,
      documentId,
      ownerUserId: user.id,
      membershipId: docCtx.membershipId,
      jobId: ingress.jobId,
      requestContext: {
        requestId: ctx.requestId,
        batchId: ctx.batchId,
        itemId: ctx.itemId,
        fileName: ingress.originalFileName,
      },
    });

    if (isStorageConfigured() && !ingress.fromStaging) {
      await storeAnalysisStaging({
        tenantId: companyId,
        ownerUserId: user.id,
        jobId: result.jobId,
        buffer: fileBuffer,
        mimeType: ingress.mimeType,
        originalFileName: ingress.originalFileName,
        storageScope,
      });
    }

    const analysisNameSnapshot = buildAnalysisJobNameSnapshot({
      originalFileName: ingress.originalFileName,
      recommendedFileName: result.recommendedFileName,
      uploadFileName: ingress.originalFileName,
    });

    await createDocumentAuditLog(auditCtx, {
      action: 'document.version_analysis_completed',
      description: 'Análise de nova versão concluída.',
      documentId,
      analysisJobId: result.jobId,
      result: result.status === 'completed' ? 'success' : 'warning',
      target: {
        type: 'analysis_job',
        id: result.jobId,
        nameSnapshot: analysisNameSnapshot,
      },
      metadata: sanitizeAuditMetadata({
        documentName: analysisNameSnapshot,
        documentId,
        currentVersionLabel: result.currentVersionLabel,
        expectedNextVersionLabel: result.expectedNextVersionLabel,
        seemsSameDocument: result.extraction?.seemsSameDocument,
        sameDocumentConfidence: result.extraction?.sameDocumentConfidence,
        status: result.status,
        source: ingress.fromStaging ? 'presigned_staging' : 'api',
        updateMode: true,
      }),
    }).catch(() => undefined);

    logger.info('analyze-pdf-update request completed', {
      requestId: ctx.requestId,
      documentId,
      jobId: result.jobId,
      status: result.status,
      fromStaging: ingress.fromStaging,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error) || isAiAnalysisError(error)) {
      const { statusCode, body } = workflowErrorFromUnknown(error, {
        requestId: ctx.requestId,
        defaultCode: isServiceError(error) ? error.code : error.code,
      });
      res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
      return res.status(statusCode).json(body);
    }

    logger.error('analyze-pdf-update unexpected error', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return res.status(500).json({ message: AI_ERROR_MESSAGES.analysisFailed });
  }
}
