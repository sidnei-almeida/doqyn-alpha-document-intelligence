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
import { AI_ERROR_MESSAGES } from '../../server/ai/constants.js';
import { isAiAnalysisError } from '../../server/ai/utils/errors.js';
import { parseMultipart } from '../../server/utils/parseMultipart.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';
import { getStorageConfig } from '../../server/storage/storageConfig.js';
import { isStorageConfigured, storeAnalysisStaging } from '../../server/storage/index.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { workflowErrorFromUnknown } from '../../server/utils/workflowErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';
import {
  buildAnalysisJobNameSnapshot,
} from '../../server/audit/documentNameSnapshot.js';

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
    const { file } = await parseMultipart(req);

    if (!file) {
      logger.warn('analyze-pdf validation failed', {
        requestId: ctx.requestId,
        reason: 'missing_file',
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ message: AI_ERROR_MESSAGES.pdfOnly });
    }

    uploadFileName = file.filename;

    if (file.size === 0) {
      logger.warn('analyze-pdf validation failed', {
        requestId: ctx.requestId,
        reason: 'empty_file',
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ message: AI_ERROR_MESSAGES.emptyFile });
    }

    if (isStorageConfigured()) {
      const storageConfig = getStorageConfig();
      if (file.size > storageConfig.maxUploadBytes) {
        logger.warn('analyze-pdf validation failed', {
          requestId: ctx.requestId,
          reason: 'file_too_large',
          fileSizeBytes: file.size,
          maxUploadBytes: storageConfig.maxUploadBytes,
          durationMs: Date.now() - startedAt,
        });
        return res.status(413).json({
          message: `Arquivo excede o limite de ${Math.floor(storageConfig.maxUploadBytes / (1024 * 1024))} MB.`,
          code: 'FILE_TOO_LARGE',
        });
      }
    }

    const companyId = getCompanyIdFromUser(user);
    const docCtx = await buildDocumentRequestContext(user);
    auditCtx = buildDocumentAuditContext(docCtx, user, ctx.requestId);

    const analysisStartedName = buildAnalysisJobNameSnapshot({
      originalFileName: file.filename,
      uploadFileName: file.filename,
    });

    await createDocumentAuditLog(auditCtx, {
      action: 'document.analysis_started',
      description: 'Análise de PDF iniciada.',
      target: {
        type: 'analysis_job',
        id: ctx.requestId,
        nameSnapshot: analysisStartedName,
      },
      metadata: sanitizeAuditMetadata({
        documentName: analysisStartedName,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        source: 'api',
      }),
    }).catch(() => undefined);

    logger.info('analyze-pdf tenant resolvido', {
      requestId: ctx.requestId,
      userId: user.id,
      tenantId: companyId,
      tenantType: user.tenantType ?? 'business',
      sessionTenantId: user.tenantId,
      sessionCompanyId: user.companyId,
    });

    const result = await analyzePdfBuffer({
      buffer: file.buffer,
      originalFileName: file.filename,
      mimeType: file.mimeType,
      companyId,
      ownerUserId: user.id,
      requestContext: {
        requestId: ctx.requestId,
        batchId: ctx.batchId,
        itemId: ctx.itemId,
        fileName: file.filename,
      },
    });

    if (isStorageConfigured()) {
      try {
        const storageScope = resolveTenantStorageScopeFromAuthUser(user);
        await storeAnalysisStaging({
          tenantId: companyId,
          ownerUserId: user.id,
          jobId: result.jobId,
          buffer: file.buffer,
          mimeType: file.mimeType,
          originalFileName: file.filename,
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
      originalFileName: file.filename,
      recommendedFileName: result.recommendedFileName,
      uploadFileName: file.filename,
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
        aiProvider: 'groq',
        errorCode: result.errorCode,
        source: 'api',
      }),
    }).catch(() => undefined);

    logger.info('analyze-pdf request completed', {
      requestId: ctx.requestId,
      batchId: ctx.batchId,
      itemId: ctx.itemId,
      fileName: file.filename,
      fileSizeBytes: file.size,
      mimeType: file.mimeType,
      aiProvider: 'groq',
      groqModel: process.env.GROQ_MODEL?.trim() || 'llama-3.1-8b-instant',
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
