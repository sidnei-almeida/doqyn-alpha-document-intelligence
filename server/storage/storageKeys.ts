import path from 'node:path';
import { extension as mimeExtension } from 'mime-types';
import { isSafeTenantIdentifier } from '../utils/tenantId.js';
import { ServiceError } from '../utils/serviceErrors.js';

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'bin',
]);

export function assertSafeStorageSegment(value: string, label: string): void {
  if (!value?.trim() || !SAFE_SEGMENT.test(value)) {
    throw new ServiceError(`${label} inválido para storage.`, 'INVALID_STORAGE_SEGMENT', 400);
  }
}

export function sanitizeFileExtension(input: { extension?: string; mimeType?: string }): string {
  const fromMime = input.mimeType ? mimeExtension(input.mimeType) : false;
  const raw = (input.extension || (typeof fromMime === 'string' ? fromMime : '') || 'bin')
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);

  if (!raw || !ALLOWED_EXTENSIONS.has(raw)) {
    return 'bin';
  }
  return raw;
}

export function buildDocumentVersionStorageKey(input: {
  tenantId: string;
  documentId: string;
  versionId: string;
  extension: string;
}): string {
  if (!isSafeTenantIdentifier(input.tenantId)) {
    throw new ServiceError('tenantId inválido para storage.', 'INVALID_TENANT_ID', 400);
  }
  assertSafeStorageSegment(input.documentId, 'documentId');
  assertSafeStorageSegment(input.versionId, 'versionId');

  const extension = sanitizeFileExtension({ extension: input.extension });
  return `documents/${input.tenantId}/${input.documentId}/versions/${input.versionId}/original.${extension}`;
}

function joinStorageKeyParts(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/** Object key R2 — business sem basePrefix; individual com basePrefix opaco. */
export function buildDocumentVersionObjectKey(input: {
  documentId: string;
  versionId: string;
  extension: string;
  keyPrefix?: string;
  basePrefix?: string;
}): string {
  assertSafeStorageSegment(input.documentId, 'documentId');
  assertSafeStorageSegment(input.versionId, 'versionId');

  const extension = sanitizeFileExtension({ extension: input.extension });
  const keyPrefix = (input.keyPrefix || 'documents').replace(/\/+$/, '');
  const objectPath = `${keyPrefix}/${input.documentId}/versions/${input.versionId}/original.${extension}`;

  return joinStorageKeyParts(input.basePrefix ?? '', objectPath);
}

/** Staging temporário entre analyze-pdf e confirm-analysis. */
export function buildAnalysisStagingKey(input: {
  jobId: string;
  extension: string;
  basePrefix?: string;
}): string {
  assertSafeStorageSegment(input.jobId, 'jobId');
  const extension = sanitizeFileExtension({ extension: input.extension });
  const stagingPath = `tmp/${input.jobId}/original.${extension}`;
  return joinStorageKeyParts(input.basePrefix ?? '', stagingPath);
}

/** @deprecated legado local — mantido para paths antigos em disco. */
export function buildLegacyAnalysisStagingKey(input: {
  tenantId: string;
  ownerUserId: string;
  jobId: string;
  extension: string;
}): string {
  if (!isSafeTenantIdentifier(input.tenantId)) {
    throw new ServiceError('tenantId inválido para storage.', 'INVALID_TENANT_ID', 400);
  }
  assertSafeStorageSegment(input.ownerUserId, 'ownerUserId');
  assertSafeStorageSegment(input.jobId, 'jobId');

  const extension = sanitizeFileExtension({ extension: input.extension });
  return `staging/${input.tenantId}/${input.ownerUserId}/${input.jobId}/original.${extension}`;
}

export function resolveStorageAbsolutePath(root: string, storageKey: string): string {
  if (!storageKey?.trim() || path.isAbsolute(storageKey)) {
    throw new ServiceError('storageKey inválida.', 'INVALID_STORAGE_KEY', 400);
  }

  if (storageKey.includes('..')) {
    throw new ServiceError('storageKey inválida.', 'INVALID_STORAGE_KEY', 400);
  }

  const rootResolved = path.resolve(root);
  const absolute = path.resolve(rootResolved, storageKey);

  if (absolute !== rootResolved && !absolute.startsWith(`${rootResolved}${path.sep}`)) {
    throw new ServiceError('Acesso ao arquivo negado.', 'STORAGE_PATH_TRAVERSAL', 403);
  }

  return absolute;
}
