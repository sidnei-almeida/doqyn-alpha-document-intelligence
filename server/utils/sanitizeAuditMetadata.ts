import { createHash } from 'node:crypto';

/** Campos proibidos em metadata de audit log — removidos integralmente. */
const REMOVE_COMPLETELY = new Set(
  [
    'recommendedFileName',
    'documentCode',
    'originalFileName',
    'fileName',
    'filename',
    'objectKey',
    'storageKey',
    'path',
    'url',
    'signedUrl',
    'downloadUrl',
    'cpf',
    'cnpj',
    'taxId',
    'taxIdRaw',
    'whatsapp',
    'phone',
    'password',
    'senha',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'clientSecret',
    'apiKey',
    'documentText',
    'extractedText',
    'ocrText',
    'rawText',
    'content',
  ].map((k) => k.toLowerCase()),
);

/** Campos que viram flags booleanas (sem valor cru). */
const FLAG_FIELDS = new Set(['recommendedfilename', 'documentcode', 'originalfilename', 'filename']);

export const FORBIDDEN_AUDIT_METADATA_KEYS = [...REMOVE_COMPLETELY];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function shouldRemoveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (REMOVE_COMPLETELY.has(normalized)) return true;
  if (/password|senha|secret|token|apikey/i.test(key)) return true;
  return false;
}

function hashValue(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Sanitiza metadata antes de persistir em audit_logs.
 * Remove PII, nomes de arquivo, códigos de documento e segredos.
 */
export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalized = normalizeKey(key);

    if (shouldRemoveKey(key)) {
      if (FLAG_FIELDS.has(normalized) && typeof value === 'string' && value.trim()) {
        if (normalized === 'recommendedfilename') result.hasRecommendedFileName = true;
        else if (normalized === 'documentcode') result.hasDocumentCode = true;
        else if (normalized === 'originalfilename' || normalized === 'filename') {
          result.hasOriginalFileName = true;
        }
      }
      continue;
    }

    if (isPlainObject(value)) {
      const nested = sanitizeAuditMetadata(value);
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    result[key] = value;
  }

  return result;
}

/** Verifica se uma chave de metadata é proibida em audit logs (para auditoria). */
export function isForbiddenAuditMetadataKey(key: string): boolean {
  return shouldRemoveKey(key);
}

/** Hash seguro opcional — nunca logar o valor de entrada. */
export function hashAuditMetadataValue(value: string): string {
  return hashValue(value);
}
