import { createHash } from 'node:crypto';
import type { MongoTenant } from '../db/types.js';
import type { TenantType } from '../db/types.js';
import { getTenantById } from '../services/tenantsService.js';
import {
  resolveTenantBucketRegistry,
} from '../services/tenantStorageConfigService.js';
import { buildTenantBucketName } from '../storage/r2/r2BucketNaming.js';
import { getR2ConfigFromEnv } from '../storage/storageConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type TenantStorageScope = {
  tenantId: string;
  tenantType: TenantType;
  ownerUserId?: string;
  provider: 'cloudflare_r2';
  bucketMode: 'per_tenant' | 'shared';
  bucketName: string;
  bucketAlias?: string;
  bucketSlug?: string;
  shortHash?: string;
  basePrefix: string;
  keyPrefix: string;
};

export type ResolveTenantStorageScopeInput = {
  tenantId: string;
  tenantType: TenantType;
  ownerUserId?: string;
  displayName?: string;
  tenantSlug?: string;
};

const INDIVIDUAL_PREFIX_SEGMENT = 'individuals';

/** Prefixo opaco por tenant PF — nunca contém CPF, e-mail ou displayName. */
export function buildIndividualBasePrefix(tenantId: string): string {
  const hash = createHash('sha256').update(tenantId.trim().toLowerCase()).digest('hex').slice(0, 16);
  return `${INDIVIDUAL_PREFIX_SEGMENT}/${hash}`;
}

/** Cálculo síncrono (sem registry) — útil em testes e planejamento. */
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
      bucketAlias: input.displayName,
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

  const planned = buildTenantBucketName({
    tenantId,
    tenantDisplayName: input.displayName,
    tenantSlug: input.tenantSlug,
  });

  return {
    tenantId,
    tenantType: 'business',
    ownerUserId: input.ownerUserId?.trim() || undefined,
    provider: 'cloudflare_r2',
    bucketMode: 'per_tenant',
    bucketName: planned.bucketName,
    bucketAlias: input.displayName,
    bucketSlug: planned.bucketSlug,
    shortHash: planned.shortHash,
    basePrefix: '',
    keyPrefix,
  };
}

/** Resolve scope a partir do registry Mongo — reutiliza bucketName salvo. */
export async function resolveTenantStorageScopeForTenant(
  tenant: MongoTenant,
  ownerUserId?: string,
): Promise<TenantStorageScope> {
  const r2Config = getR2ConfigFromEnv();
  const keyPrefix = r2Config?.keyPrefix?.trim() || 'documents';

  if (tenant.tenantType === 'individual') {
    const resolvedOwner = ownerUserId?.trim();
    if (!resolvedOwner) {
      throw new ServiceError(
        'ownerUserId é obrigatório para storage de pessoa física.',
        'OWNER_USER_REQUIRED',
        400,
      );
    }

    const defaultBucket = r2Config?.defaultBucket?.trim() || 'doqyn-alpha';
    const registryBucket = tenant.storage?.bucketName?.trim() || defaultBucket;

    return {
      tenantId: tenant.tenantId,
      tenantType: 'individual',
      ownerUserId: resolvedOwner,
      provider: 'cloudflare_r2',
      bucketMode: 'shared',
      bucketName: registryBucket,
      bucketAlias: tenant.storage?.bucketAlias ?? tenant.displayName,
      basePrefix: buildIndividualBasePrefix(tenant.tenantId),
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

  const registry =
    tenant.storage?.bucketName != null
      ? tenant.storage
      : await resolveTenantBucketRegistry(tenant);

  return {
    tenantId: tenant.tenantId,
    tenantType: 'business',
    ownerUserId: ownerUserId?.trim() || undefined,
    provider: 'cloudflare_r2',
    bucketMode: 'per_tenant',
    bucketName: registry.bucketName,
    bucketAlias: registry.bucketAlias ?? tenant.displayName,
    bucketSlug: registry.bucketSlug,
    shortHash: registry.shortHash,
    basePrefix: '',
    keyPrefix,
  };
}

export async function resolveTenantStorageScopeById(
  tenantId: string,
  ownerUserId?: string,
): Promise<TenantStorageScope> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return resolveTenantStorageScope({
      tenantId,
      tenantType: 'business',
      ownerUserId,
      displayName: tenantId,
      tenantSlug: tenantId,
    });
  }

  return resolveTenantStorageScopeForTenant(tenant, ownerUserId);
}
