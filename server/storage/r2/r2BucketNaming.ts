import { createHash } from 'node:crypto';
import type { R2BucketMode } from '../storageConfig.js';

const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}$/;

/** Nome opaco do bucket — nunca usa displayName, e-mail, CPF ou CNPJ. */
export function getTenantBucketName(
  tenantId: string,
  options: {
    bucketPrefix: string;
    bucketMode: R2BucketMode;
    defaultBucket: string;
  },
): string {
  if (options.bucketMode === 'shared') {
    return sanitizeBucketName(options.defaultBucket);
  }

  const normalized = tenantId.trim().toLowerCase();
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  const prefix = sanitizeBucketSegment(options.bucketPrefix || 'doqyn');
  return sanitizeBucketName(`${prefix}-t-${hash}`);
}

function sanitizeBucketSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20) || 'doqyn';
}

function sanitizeBucketName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!BUCKET_NAME_PATTERN.test(cleaned)) {
    throw new Error('Nome de bucket R2 inválido após sanitização.');
  }

  return cleaned;
}
