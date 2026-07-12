import type { VercelRequest, VercelResponse } from '@vercel/node';
import { canAnalyzeDocuments } from '../../server/auth/permissions.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { getCompanyIdFromUser } from '../../server/auth/companyContext.js';
import { resolveTenantStorageScopeFromAuthUser } from '../../server/tenancy/documentRequestContext.js';
import { assertTenantQuota } from '../../server/tenancy/tenantQuotas.js';
import { issueAnalysisStagingUploadUrl } from '../../server/services/analysis/analysisStagingUploadService.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { extractRequestContext } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';

type UploadUrlRequestBody = {
  fileName?: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

function parseUploadUrlBody(body: unknown): UploadUrlRequestBody {
  if (!body || typeof body !== 'object') {
    return {};
  }
  return body as UploadUrlRequestBody;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = extractRequestContext(req);
  const user = await requireAuth(req, res);
  if (!user) return;

  if (!canAnalyzeDocuments(user)) {
    return res.status(403).json({ message: 'Sem permissão para enviar documentos.' });
  }

  try {
    const body = parseUploadUrlBody(req.body);
    const fileName = body.fileName?.trim() || body.originalFileName?.trim() || '';
    const sizeBytes = Number(body.sizeBytes);

    if (!fileName) {
      return res.status(400).json({ message: 'fileName é obrigatório.', code: 'FILE_NAME_REQUIRED' });
    }

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return res.status(400).json({ message: 'sizeBytes inválido.', code: 'INVALID_SIZE_BYTES' });
    }

    const tenantId = getCompanyIdFromUser(user);
    await assertTenantQuota(tenantId, 'uploads_per_hour');

    const storageScope = resolveTenantStorageScopeFromAuthUser(user);
    const issued = await issueAnalysisStagingUploadUrl({
      tenantId,
      ownerUserId: user.id,
      originalFileName: fileName,
      mimeType: body.mimeType,
      sizeBytes,
      storageScope,
    });

    logger.info('staging upload-url issued', {
      requestId: ctx.requestId,
      tenantId,
      jobId: issued.jobId,
      sizeBytes,
      fileName,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(200).json(issued);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }

    logger.error('upload-url failed', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return res.status(500).json({ message: 'Erro ao gerar URL de upload.' });
  }
}
