import { createHash } from 'node:crypto';

/** Campos proibidos em metadata de audit log — removidos integralmente. */
const REMOVE_COMPLETELY = new Set(
  [
    'recommendedFileName',
    'finalFileName',
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
    'presignedUrl',
    'cpf',
    'cnpj',
    'taxId',
    'taxIdRaw',
    'whatsapp',
    'phone',
    'recipientphone',
    'recipientphonenormalized',
    'ipaddress',
    'ipaddressencrypted',
    'securityauditrestricted',
    'password',
    'passwordHash',
    'senha',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'clientSecret',
    'apiKey',
    'authorization',
    'cookie',
    'documentText',
    'extractedText',
    'ocrText',
    'rawText',
    'content',
  ].map((k) => k.toLowerCase()),
);

/** Campos que viram flags booleanas (sem valor cru). */
const FLAG_FIELDS = new Set([
  'recommendedfilename',
  'finalfilename',
  'documentcode',
  'originalfilename',
  'filename',
]);

const FILENAME_AUDIT_FIELDS = new Set([
  'finalfilename',
  'aishuggestedfilename',
  'selectedfilename',
  'recommendedfilename',
  'originalfilename',
  'filename',
  'storagefilename',
  'previewstoragefilename',
  'documentname',
  'namesnapshot',
]);

const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const CNPJ_PATTERN = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const FORBIDDEN_AUDIT_METADATA_KEYS = [...REMOVE_COMPLETELY];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function shouldRemoveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (REMOVE_COMPLETELY.has(normalized)) return true;
  if (/password|senha|secret|token|apikey|authorization|cookie/i.test(key)) return true;
  return false;
}

function hashValue(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function redactSensitiveString(value: string): string {
  return value
    .replace(CPF_PATTERN, '[CPF]')
    .replace(CNPJ_PATTERN, '[CNPJ]')
    .replace(EMAIL_PATTERN, '[email]');
}

function sanitizeAuditStringValue(field: string | undefined, value: string): string {
  const normalizedField = field ? normalizeKey(field) : '';
  if (FILENAME_AUDIT_FIELDS.has(normalizedField)) {
    return redactSensitiveString(value);
  }
  return redactSensitiveString(value);
}

function isAuditChangeEntry(value: unknown): value is { field?: unknown; before?: unknown; after?: unknown } {
  return isPlainObject(value) && 'field' in value && ('before' in value || 'after' in value);
}

function sanitizeAuditChangeEntry(change: { field?: unknown; before?: unknown; after?: unknown }): Record<string, unknown> {
  const field = typeof change.field === 'string' ? change.field : String(change.field ?? '');
  const before =
    typeof change.before === 'string'
      ? sanitizeAuditStringValue(field, change.before)
      : sanitizeAuditValue(change.before, field);
  const after =
    typeof change.after === 'string'
      ? sanitizeAuditStringValue(field, change.after)
      : sanitizeAuditValue(change.after, field);

  return { field, before, after };
}

export function sanitizeAuditValue(value: unknown, parentField?: string): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return sanitizeAuditStringValue(parentField, value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    if (parentField === 'changes') {
      return value.map((item) =>
        isAuditChangeEntry(item) ? sanitizeAuditChangeEntry(item) : sanitizeAuditValue(item),
      );
    }
    return value.map((item) => sanitizeAuditValue(item, parentField));
  }

  if (isPlainObject(value)) {
    return sanitizeAuditMetadata(value);
  }

  return value;
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
        else if (normalized === 'finalfilename') result.hasFinalFileName = true;
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
      const sanitized = sanitizeAuditValue(value, key);
      if (Array.isArray(sanitized) && sanitized.length > 0) {
        result[key] = sanitized;
      }
      continue;
    }

    if (typeof value === 'string') {
      result[key] = sanitizeAuditStringValue(key, value);
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
