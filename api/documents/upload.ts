import type { VercelRequest, VercelResponse } from '@vercel/node';
import { lookup } from 'mime-types';
import { uploadDocument } from '../../server/services/documentService.js';
import { getStorageConfig } from '../../server/storage/storageConfig.js';
import { requireDocumentRequestContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export const config = {
  api: { bodyParser: false },
};

async function parseMultipart(req: VercelRequest): Promise<{
  fields: Record<string, string>;
  file?: { buffer: Buffer; filename: string; mimeType: string; size: number };
}> {
  const contentType = req.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    const body = req.body as Record<string, string> | undefined;
    return { fields: body ?? {} };
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return { fields: {} };

  const parts = buffer.toString('binary').split(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; filename: string; mimeType: string; size: number } | undefined;

  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;

    const nameMatch = part.match(/name="([^"]+)"/);
    const filenameMatch = part.match(/filename="([^"]+)"/);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1 || !nameMatch) continue;

    const value = part.slice(headerEnd + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');

    if (filenameMatch) {
      const fileBuffer = Buffer.from(value, 'binary');
      const filename = filenameMatch[1];
      file = {
        buffer: fileBuffer,
        filename,
        mimeType: lookup(filename) || 'application/octet-stream',
        size: fileBuffer.length,
      };
    } else {
      fields[nameMatch[1]] = value;
    }
  }

  return { fields, file };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = await requireDocumentRequestContext(req, res);
  if (!ctx) return;

  try {
    const { fields, file } = await parseMultipart(req);

    if (file) {
      const { maxUploadBytes } = getStorageConfig();
      if (file.size > maxUploadBytes) {
        return res.status(413).json({
          message: `Arquivo excede o limite de ${Math.floor(maxUploadBytes / (1024 * 1024))} MB.`,
          code: 'FILE_TOO_LARGE',
        });
      }
    }

    const accessGroups = fields.accessGroups ? JSON.parse(fields.accessGroups) : [];
    const originalFileName = file?.filename ?? fields.fileName ?? 'documento.pdf';
    const displayName = originalFileName.replace(/\.[^.]+$/, '');

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
