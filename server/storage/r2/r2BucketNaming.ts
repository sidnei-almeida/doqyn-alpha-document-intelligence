import { createHash } from 'node:crypto';
import type { R2BucketMode } from '../storageConfig.js';
import { slugifyName } from '../../utils/slugify.js';

const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}$/;
const MAX_BUCKET_NAME_LENGTH = 63;

/** Padrão legado: doqyn-t-{hash12} */
export const LEGACY_TENANT_BUCKET_PATTERN = /^doqyn-t-[a-f0-9]{12}$/;

export type R2AppEnv = 'dev' | 'staging' | 'prod' | 'test';

export type BuildTenantBucketNameInput = {
  appName?: string;
  env?: R2AppEnv;
  tenantId: string;
  tenantDisplayName?: string;
  tenantSlug?: string;
};

export type BuildTenantBucketNameResult = {
  bucketName: string;
  bucketSlug: string;
  shortHash: string;
};

export function resolveR2AppEnv(): R2AppEnv {
  const raw = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development').trim().toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'prod';
  if (raw === 'staging') return 'staging';
  if (raw === 'test') return 'test';
  return 'dev';
}

export function deriveTenantShortHash(tenantId: string): string {
  return createHash('sha256').update(tenantId.trim().toLowerCase()).digest('hex').slice(0, 12);
}

/**
 * Segmento legível do nome do bucket.
 *
 * Deriva do `tenantId` sempre que ele existir, e só cai em slug/displayName quando não houver —
 * o que na prática não acontece. Dois motivos, os dois observados em 2026-08-13:
 *
 * 1. **Chamadores diferentes produziam nomes diferentes.** A precedência anterior era
 *    `slug || displayName || tenantId`, então o nome dependia de quais campos quem chamou tinha em
 *    mãos: `planTenantBucketName` passa `tenant.slug` e gerava `…-doqyn-dev-<hash>`, enquanto
 *    `resolveTenantStorageScope` sem slug carregado gerava `…-company-dev-<hash>`. O mesmo tenant
 *    ganhou dois buckets, e o desenho é um por tenant.
 *
 * 2. **Renomear a empresa renomeava o bucket.** Slug e displayName são editáveis pelo cliente; o
 *    `tenantId` não. Com o nome derivado de campo mutável, uma troca de razão social apontaria para
 *    um bucket novo e deixaria todo documento anterior inalcançável.
 *
 * O hash já era `sha256(tenantId)`. Agora o nome inteiro é função pura do `tenantId`.
 *
 * Tenant existente não é afetado: `resolveTenantStorageScope` lê `tenant.storage.bucketName` do
 * registro antes de calcular qualquer coisa. Isto governa apenas provisionamento novo.
 */
export function deriveTenantBucketSlug(
  tenantDisplayName?: string,
  tenantSlug?: string,
  tenantId?: string,
): string {
  const fromId = tenantId?.trim() ? slugifyName(tenantId) : '';
  const fromSlug = tenantSlug?.trim() ? slugifyName(tenantSlug) : '';
  const fromName = tenantDisplayName?.trim() ? slugifyName(tenantDisplayName) : '';
  return fromId || fromSlug || fromName || '';
}

export function isLegacyTenantBucketName(bucketName: string): boolean {
  return LEGACY_TENANT_BUCKET_PATTERN.test(bucketName.trim());
}

function sanitizeBucketSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'doqyn'
  );
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

/**
 * Nome amigável e determinístico:
 * doqyn-{env}-t-{tenantSlug}-{shortHash}
 * Fallback sem slug: doqyn-{env}-t-{shortHash}
 */
export function buildTenantBucketName(
  input: BuildTenantBucketNameInput,
): BuildTenantBucketNameResult {
  const appName = sanitizeBucketSegment(input.appName ?? 'doqyn');
  const env = input.env ?? resolveR2AppEnv();
  const shortHash = deriveTenantShortHash(input.tenantId);
  const bucketSlug = deriveTenantBucketSlug(
    input.tenantDisplayName,
    input.tenantSlug,
    input.tenantId,
  );

  const prefix = `${appName}-${env}-t-`;
  const suffix = `-${shortHash}`;
  const maxSlugLength = Math.max(1, MAX_BUCKET_NAME_LENGTH - prefix.length - suffix.length);
  const slugPart = bucketSlug ? bucketSlug.slice(0, maxSlugLength) : '';

  const bucketName = sanitizeBucketName(
    slugPart ? `${prefix}${slugPart}${suffix}` : `${prefix}${shortHash}`,
  );

  return {
    bucketName,
    bucketSlug: slugPart || shortHash,
    shortHash,
  };
}

/** @deprecated Use buildTenantBucketName — mantido para leitura de buckets legados. */
export function buildLegacyTenantBucketName(
  tenantId: string,
  bucketPrefix = 'doqyn',
): string {
  const hash = deriveTenantShortHash(tenantId);
  const prefix = sanitizeBucketSegment(bucketPrefix);
  return sanitizeBucketName(`${prefix}-t-${hash}`);
}

/** Resolve nome de bucket por tenant — usa padrão amigável (não legado). */
export function getTenantBucketName(
  tenantId: string,
  options: {
    bucketPrefix: string;
    bucketMode: R2BucketMode;
    defaultBucket: string;
    tenantDisplayName?: string;
    tenantSlug?: string;
    env?: R2AppEnv;
  },
): string {
  if (options.bucketMode === 'shared') {
    return sanitizeBucketName(options.defaultBucket);
  }

  return buildTenantBucketName({
    appName: options.bucketPrefix || 'doqyn',
    env: options.env,
    tenantId,
    tenantDisplayName: options.tenantDisplayName,
    tenantSlug: options.tenantSlug,
  }).bucketName;
}
