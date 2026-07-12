import type { IncomingMessage } from 'node:http';
import { parseMultipart } from './parseMultipart.js';
import { ServiceError } from './serviceErrors.js';

export type AnalyzePdfStagingRequest = {
  jobId: string;
  originalFileName?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes: number;
  documentId?: string;
};

export type ParsedAnalyzePdfRequest =
  | {
      mode: 'multipart';
      file: NonNullable<Awaited<ReturnType<typeof parseMultipart>>['file']>;
      fields: Record<string, string>;
    }
  | {
      mode: 'staging';
      staging: AnalyzePdfStagingRequest;
    };

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function parseStagingBody(body: unknown): AnalyzePdfStagingRequest {
  if (!body || typeof body !== 'object') {
    throw new ServiceError('Corpo JSON inválido.', 'INVALID_REQUEST_BODY', 400);
  }

  const record = body as Record<string, unknown>;
  const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
  if (!jobId) {
    throw new ServiceError('jobId é obrigatório.', 'JOB_ID_REQUIRED', 400);
  }

  const sizeBytes = Number(record.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new ServiceError('sizeBytes inválido.', 'INVALID_SIZE_BYTES', 400);
  }

  const originalFileName =
    (typeof record.originalFileName === 'string' && record.originalFileName.trim()) ||
    (typeof record.fileName === 'string' && record.fileName.trim()) ||
    undefined;

  const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim() : undefined;
  const documentId = typeof record.documentId === 'string' ? record.documentId.trim() : undefined;

  return {
    jobId,
    originalFileName,
    fileName: originalFileName,
    mimeType,
    sizeBytes,
    documentId: documentId || undefined,
  };
}

export async function parseAnalyzePdfRequest(req: IncomingMessage): Promise<ParsedAnalyzePdfRequest> {
  const contentType = req.headers['content-type'] ?? '';

  if (contentType.includes('application/json')) {
    const body = await readJsonBody(req);
    return {
      mode: 'staging',
      staging: parseStagingBody(body),
    };
  }

  const { file, fields } = await parseMultipart(req);
  if (!file) {
    throw new ServiceError('Arquivo PDF não enviado.', 'FILE_REQUIRED', 400);
  }

  return {
    mode: 'multipart',
    file,
    fields,
  };
}
