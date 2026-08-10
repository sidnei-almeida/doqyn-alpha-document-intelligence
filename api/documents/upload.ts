import type { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadDocument } from '../../server/services/documentService.js';
import { getStorageConfig } from '../../server/storage/storageConfig.js';
import { requireDocumentRequestContext } from '../../server/tenancy/documentRequestContext.js';
import {
  assertTenantQuota,
  assertTenantQuotaAvailable,
} from '../../server/tenancy/tenantQuotas.js';
import { parseMultipart } from '../../server/utils/parseMultipart.js';
import { ServiceError, isServiceError } from '../../server/utils/serviceErrors.js';

export const config = {
  api: { bodyParser: false },
};

/**
 * Folga para o envelope multipart — boundary, cabeçalhos de parte e campos de texto. O
 * `Content-Length` mede o corpo inteiro, enquanto o teto do busboy vale só para os bytes do
 * arquivo; sem a folga, um arquivo de exatamente `maxUploadBytes` seria recusado aqui por causa do
 * envelope, apesar de o parser aceitá-lo.
 */
const MULTIPART_ENVELOPE_HEADROOM_BYTES = 1024 * 1024;

/**
 * Rejeita pelo `Content-Length` antes de ler qualquer byte do corpo. O teto do busboy é a defesa
 * real (um cliente pode mentir no cabeçalho ou usar `Transfer-Encoding: chunked`), mas quando o
 * cabeçalho é honesto isto evita transferir o arquivo inteiro só para descartá-lo.
 */
function declaredSizeExceedsLimit(req: VercelRequest, maxUploadBytes: number): boolean {
  const declared = Number(req.headers['content-length']);
  return Number.isFinite(declared) && declared > maxUploadBytes + MULTIPART_ENVELOPE_HEADROOM_BYTES;
}

/** `accessGroups` vem do cliente; JSON inválido é erro de requisição, não falha do servidor. */
function parseAccessGroups(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    throw new ServiceError('Campo accessGroups inválido.', 'INVALID_ACCESS_GROUPS', 400);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = await requireDocumentRequestContext(req, res);
  if (!ctx) return;

  try {
    const { maxUploadBytes } = getStorageConfig();

    if (declaredSizeExceedsLimit(req, maxUploadBytes)) {
      return res.status(413).json({
        message: `Arquivo excede o limite de ${Math.floor(maxUploadBytes / (1024 * 1024))} MB.`,
        code: 'FILE_TOO_LARGE',
      });
    }

    // Antes do parse, só verifica: um tenant que já estourou o limite não deve consumir CPU e
    // memória da máquina inteira lendo o corpo da requisição para só então ser recusado.
    await assertTenantQuotaAvailable(ctx.tenantId, 'uploads_per_hour');

    const contentType = req.headers['content-type'] ?? '';
    const { fields, file } = contentType.includes('multipart/form-data')
      ? await parseMultipart(req, { maxFileBytes: maxUploadBytes })
      : { fields: (req.body as Record<string, string> | undefined) ?? {}, file: undefined };

    const accessGroups = parseAccessGroups(fields.accessGroups);
    const originalFileName = file?.filename ?? fields.fileName ?? 'documento.pdf';
    const displayName = originalFileName.replace(/\.[^.]+$/, '');

    // O slot só é consumido quando o upload de fato vai acontecer: arquivo grande demais, multipart
    // malformado ou cliente que desiste não podem queimar a cota horária do tenant.
    await assertTenantQuota(ctx.tenantId, 'uploads_per_hour');

    const result = await uploadDocument({
      tenantId: ctx.tenantId,
      ownerUserId: ctx.userId,
      ownerName: fields.ownerName ?? ctx.collections.tenant.displayName ?? 'Usuário',
      originalFileName,
      displayName,
      documentType: fields.documentType ?? 'Outro',
      accessGroups,
      notes: fields.notes,
      fileSize: file?.size ?? 0,
      mimeType: file?.mimeType ?? 'application/octet-stream',
      fileBuffer: file?.buffer,
      storageScope: ctx.storageScope,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Erro no envio do documento',
    });
  }
}
