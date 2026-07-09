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
import { parseMultipart } from '../../server/utils/parseMultipart.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';
import { getStorageConfig } from '../../server/storage/storageConfig.js';
import { isStorageConfigured, storeAnalysisStaging } from '../../server/storage/index.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { workflowErrorFromUnknown } from '../../server/utils/workflowErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';
import { buildAnalysisJobNameSnapshot } from '../../server/audit/documentNameSnapshot.js';
import { assertCanUpdateExistingDocument } from '../../server/services/documentVersionService.js';

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
    const { file, fields } = await parseMultipart(req);
    const documentId = fields.documentId?.trim();

    if (!documentId) {
      return res.status(400).json({
        message: 'documentId é obrigatório para análise de atualização.',
        code: 'DOCUMENT_ID_REQUIRED',
      });
    }

    if (!file) {
      return res.status(400).json({ message: AI_ERROR_MESSAGES.pdfOnly });
    }

    if (file.size === 0) {
      return res.status(400).json({ message: AI_ERROR_MESSAGES.emptyFile });
    }

    if (isStorageConfigured()) {
      const storageConfig = getStorageConfig();
      if (file.size > storageConfig.maxUploadBytes) {
        return res.status(413).json({
          message: `Arquivo excede o limite de ${Math.floor(storageConfig.maxUploadBytes / (1024 * 1024))} MB.`,
          code: 'FILE_TOO_LARGE',
        });
      }
    }

    const companyId = getCompanyIdFromUser(user);
    const docCtx = await buildDocumentRequestContext(user);
    auditCtx = buildDocumentAuditContext(docCtx, user, ctx.requestId);

    await assertCanUpdateExistingDocument({
      documentId,
      tenantId: companyId,
      ownerUserId: user.id,
      user,
      membershipId: docCtx.membershipId,
    });

    const result = await analyzePdfUpdateBuffer({
      buffer: file.buffer,
      originalFileName: file.filename,
      mimeType: file.mimeType,
      companyId,
      documentId,
      ownerUserId: user.id,
      membershipId: docCtx.membershipId,
      requestContext: {
        requestId: ctx.requestId,
        batchId: ctx.batchId,
        itemId: ctx.itemId,
        fileName: file.filename,
      },
    });

    if (isStorageConfigured()) {
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
    }

    const analysisNameSnapshot = buildAnalysisJobNameSnapshot({
      originalFileName: file.filename,
      recommendedFileName: result.recommendedFileName,
      uploadFileName: file.filename,
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
        source: 'api',
        updateMode: true,
      }),
    }).catch(() => undefined);

    logger.info('analyze-pdf-update request completed', {
      requestId: ctx.requestId,
      documentId,
      jobId: result.jobId,
      status: result.status,
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
