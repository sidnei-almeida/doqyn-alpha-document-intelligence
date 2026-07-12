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
import { analyzePdfBuffer } from '../../server/ai/services/analyzePdfService.js';
import { resolveAnalysisProviderName } from '../../server/ai/providers/resolveAnalysisProvider.js';
import { AI_ERROR_MESSAGES } from '../../server/ai/constants.js';
import { isAiAnalysisError } from '../../server/ai/utils/errors.js';
import { parseAnalyzePdfRequest } from '../../server/utils/parseAnalyzePdfRequest.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';
import { isStorageConfigured, storeAnalysisStaging } from '../../server/storage/index.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { workflowErrorFromUnknown } from '../../server/utils/workflowErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';
import {
  buildAnalysisJobNameSnapshot,
} from '../../server/audit/documentNameSnapshot.js';
import { assertTenantQuota } from '../../server/tenancy/tenantQuotas.js';
import {
  enqueuePdfAnalysisJob,
  enqueuePdfAnalysisJobFromStaging,
  isAsyncPdfAnalysisAvailable,
} from '../../server/services/analysis/enqueuePdfAnalysisJob.js';
import {
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

  logger.info('analyze-pdf request started', {
    requestId: ctx.requestId,
    batchId: ctx.batchId,
    itemId: ctx.itemId,
    fileName: ctx.fileName,
    endpoint: '/api/ai/analyze-pdf',
    ...getBearerAuthLogFields(req),
  });

  const user = await requireAuth(req, res);
  if (!user) return;

  let auditCtx: ReturnType<typeof buildDocumentAuditContext> | null = null;
  let uploadFileName: string | undefined;

  if (!canAnalyzeDocuments(user)) {
    logger.warn('analyze-pdf forbidden', {
      requestId: ctx.requestId,
      userId: user.id,
      durationMs: Date.now() - startedAt,
    });
    return res.status(403).json({ message: 'Sem permissão para analisar documentos.' });
  }

  try {
    const parsed = await parseAnalyzePdfRequest(req);

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

    uploadFileName = ingress.originalFileName;

    const analysisStartedName = buildAnalysisJobNameSnapshot({
      originalFileName: ingress.originalFileName,
      uploadFileName: ingress.originalFileName,
    });

    await createDocumentAuditLog(auditCtx, {
      action: 'document.analysis_started',
      description: 'Análise de PDF iniciada.',
      target: {
        type: 'analysis_job',
        id: ingress.jobId ?? ctx.requestId,
        nameSnapshot: analysisStartedName,
      },
      metadata: sanitizeAuditMetadata({
        documentName: analysisStartedName,
        mimeType: ingress.mimeType,
        sizeBytes: ingress.fileSize,
        source: ingress.fromStaging ? 'presigned_staging' : 'api',
      }),
    }).catch(() => undefined);

    logger.info('analyze-pdf tenant resolvido', {
      requestId: ctx.requestId,
      userId: user.id,
      tenantId: companyId,
      tenantType: user.tenantType ?? 'business',
      sessionTenantId: user.tenantId,
      sessionCompanyId: user.companyId,
      fromStaging: ingress.fromStaging,
      jobId: ingress.jobId,
    });

    await assertTenantQuota(companyId, 'analysis_per_day');

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
                jobKind: 'initial',
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
                jobKind: 'initial',
              });

        logger.info('analyze-pdf enfileirado', {
          requestId: ctx.requestId,
          jobId: queued.jobId,
          tenantId: companyId,
          aiProvider,
          fromStaging: ingress.fromStaging,
          durationMs: Date.now() - startedAt,
        });

        res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
        return res.status(202).json(queued);
      } catch (stagingError) {
        if (isServiceError(stagingError)) {
          logger.warn('analyze-pdf staging failed (async)', {
            requestId: ctx.requestId,
            code: stagingError.code,
            message: stagingError.message,
            durationMs: Date.now() - startedAt,
          });
          const { statusCode, body } = workflowErrorFromUnknown(stagingError, {
            requestId: ctx.requestId,
            defaultCode: stagingError.code,
          });
          return res.status(statusCode).json(body);
        }
        throw stagingError;
      }
    }

    const fileBuffer = ingress.buffer;
    if (!fileBuffer) {
      return res.status(500).json({ message: AI_ERROR_MESSAGES.analysisFailed });
    }

    const result = await analyzePdfBuffer({
      buffer: fileBuffer,
      originalFileName: ingress.originalFileName,
      mimeType: ingress.mimeType,
      companyId,
      ownerUserId: user.id,
      jobId: ingress.jobId,
      requestContext: {
        requestId: ctx.requestId,
        batchId: ctx.batchId,
        itemId: ctx.itemId,
        fileName: ingress.originalFileName,
      },
    });

    if (isStorageConfigured() && !ingress.fromStaging) {
      try {
        await storeAnalysisStaging({
          tenantId: companyId,
          ownerUserId: user.id,
          jobId: result.jobId,
          buffer: fileBuffer,
          mimeType: ingress.mimeType,
          originalFileName: ingress.originalFileName,
          storageScope,
        });
      } catch (stagingError) {
        if (isServiceError(stagingError)) {
          logger.warn('analyze-pdf staging failed', {
            requestId: ctx.requestId,
            code: stagingError.code,
            message: stagingError.message,
            durationMs: Date.now() - startedAt,
          });
          const { statusCode, body } = workflowErrorFromUnknown(stagingError, {
            requestId: ctx.requestId,
            defaultCode: stagingError.code,
          });
          return res.status(statusCode).json(body);
        }
        throw stagingError;
      }
    }

    const analysisAction =
      result.errorCode || result.status === 'ai_unavailable'
        ? 'document.analysis_failed'
        : 'document.analysis_completed';

    const analysisNameSnapshot = buildAnalysisJobNameSnapshot({
      originalFileName: ingress.originalFileName,
      recommendedFileName: result.recommendedFileName,
      uploadFileName: ingress.originalFileName,
    });

    await createDocumentAuditLog(auditCtx, {
      action: analysisAction,
      description:
        analysisAction === 'document.analysis_completed'
          ? 'Análise de PDF concluída.'
          : 'Falha na análise de PDF.',
      analysisJobId: result.jobId,
      result: analysisAction === 'document.analysis_completed' ? 'success' : 'error',
      target: {
        type: 'analysis_job',
        id: result.jobId,
        nameSnapshot: analysisNameSnapshot,
      },
      metadata: sanitizeAuditMetadata({
        documentName: analysisNameSnapshot,
        aiSuggestedFileName: result.recommendedFileName ?? undefined,
        status: result.status,
        categoryId: result.classification.classId,
        categoryName: result.classification.className,
        confidence: result.classification.confidence,
        checksumSha256: result.fileHash,
        sizeBytes: result.fileSizeBytes,
        durationMs: Date.now() - startedAt,
        aiProvider,
        errorCode: result.errorCode,
        source: ingress.fromStaging ? 'presigned_staging' : 'api',
      }),
    }).catch(() => undefined);

    logger.info('analyze-pdf request completed', {
      requestId: ctx.requestId,
      batchId: ctx.batchId,
      itemId: ctx.itemId,
      fileName: ingress.originalFileName,
      fileSizeBytes: ingress.fileSize,
      mimeType: ingress.mimeType,
      fromStaging: ingress.fromStaging,
      aiProvider,
      jobId: result.jobId,
      status: result.status,
      className: result.classification.className,
      classId: result.classification.classId,
      confidence: result.classification.confidence,
      requiresReview: result.classification.requiresReview,
      textCharCount: result.textExtraction.charCount,
      pageCount: result.textExtraction.pageCount,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(200).json(result);
  } catch (error) {
    if (auditCtx) {
      const failedNameSnapshot = buildAnalysisJobNameSnapshot({
        originalFileName: uploadFileName ?? ctx.fileName,
        uploadFileName: uploadFileName ?? ctx.fileName,
      });

      await createDocumentAuditLog(auditCtx, {
        action: 'document.analysis_failed',
        description: 'Falha na análise de PDF.',
        result: 'error',
        target: {
          type: 'analysis_job',
          id: ctx.requestId,
          nameSnapshot: failedNameSnapshot,
        },
        metadata: sanitizeAuditMetadata({
          documentName: failedNameSnapshot,
          reason: error instanceof Error ? error.message : 'unknown',
          durationMs: Date.now() - startedAt,
          source: 'api',
        }),
      }).catch(() => undefined);
    }

    if (isServiceError(error)) {
      logger.warn('analyze-pdf controlled error', {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      const { statusCode, body } = workflowErrorFromUnknown(error, {
        requestId: ctx.requestId,
        defaultCode: error.code,
      });
      res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
      return res.status(statusCode).json(body);
    }

    if (isAiAnalysisError(error)) {
      logger.warn('analyze-pdf controlled error', {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      const { statusCode, body } = workflowErrorFromUnknown(error, {
        requestId: ctx.requestId,
      });
      res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
      return res.status(statusCode).json(body);
    }

    logger.error('analyze-pdf unexpected error', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ message: AI_ERROR_MESSAGES.analysisFailed });
  }
}
