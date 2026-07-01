import { createHash } from 'node:crypto';
import type { TenantType } from '../db/types.js';
import { getTenantBucketName } from '../storage/r2/r2BucketNaming.js';
import { getR2ConfigFromEnv } from '../storage/storageConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type TenantStorageScope = {
  tenantId: string;
  tenantType: TenantType;
  ownerUserId?: string;
  provider: 'cloudflare_r2';
  bucketMode: 'per_tenant' | 'shared';
  bucketName: string;
  basePrefix: string;
  keyPrefix: string;
};

export type ResolveTenantStorageScopeInput = {
  tenantId: string;
  tenantType: TenantType;
  ownerUserId?: string;
};

const INDIVIDUAL_PREFIX_SEGMENT = 'individuals';

/** Prefixo opaco por tenant PF — nunca contém CPF, e-mail ou displayName. */
export function buildIndividualBasePrefix(tenantId: string): string {
  const hash = createHash('sha256').update(tenantId.trim().toLowerCase()).digest('hex').slice(0, 16);
  return `${INDIVIDUAL_PREFIX_SEGMENT}/${hash}`;
}

export function resolveTenantStorageScope(
  input: ResolveTenantStorageScopeInput,
): TenantStorageScope {
  const tenantId = input.tenantId?.trim();
  if (!tenantId) {
    throw new ServiceError('tenantId é obrigatório para storage scope.', 'TENANT_ID_REQUIRED', 400);
  }

  const r2Config = getR2ConfigFromEnv();
  const keyPrefix = r2Config?.keyPrefix?.trim() || 'documents';

  if (input.tenantType === 'individual') {
    const ownerUserId = input.ownerUserId?.trim();
    if (!ownerUserId) {
      throw new ServiceError(
        'ownerUserId é obrigatório para storage de pessoa física.',
        'OWNER_USER_REQUIRED',
        400,
      );
    }

    const defaultBucket = r2Config?.defaultBucket?.trim() || 'doqyn-alpha';

    return {
      tenantId,
      tenantType: 'individual',
      ownerUserId,
      provider: 'cloudflare_r2',
      bucketMode: 'shared',
      bucketName: defaultBucket,
      basePrefix: buildIndividualBasePrefix(tenantId),
      keyPrefix,
    };
  }

  if (!r2Config) {
    throw new ServiceError(
      'Configuração R2 ausente para tenant business.',
      'R2_CONFIG_MISSING',
      500,
    );
  }

  const bucketName = getTenantBucketName(tenantId, {
    bucketPrefix: r2Config.bucketPrefix,
    bucketMode: 'per_tenant',
    defaultBucket: r2Config.defaultBucket,
  });

  return {
    tenantId,
    tenantType: 'business',
    ownerUserId: input.ownerUserId?.trim() || undefined,
    provider: 'cloudflare_r2',
    bucketMode: 'per_tenant',
    bucketName,
    basePrefix: '',
    keyPrefix,
  };
}
