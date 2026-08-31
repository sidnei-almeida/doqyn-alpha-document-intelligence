import type { R2Config } from '../storageConfig.js';
import { logger } from '../../utils/logger.js';
import { createR2AdminClient } from './r2Clients.js';
import { buildLegacyTenantBucketName } from './r2BucketNaming.js';
import { ensureBucketCors } from './bucketCors.js';

export type EnsureBucketResult = {
  bucket: string;
  created: boolean;
  /** Hash da política de CORS confirmada no bucket — gravado no registry do tenant. */
  corsPolicyHash: string;
};

export type EnsureTenantBucketInput = {
  tenantId: string;
  bucketName?: string;
  config: R2Config;
  adminClient?: import('@aws-sdk/client-s3').S3Client;
};

export function resolveTenantBucketName(tenantId: string, config: R2Config): string {
  return buildLegacyTenantBucketName(tenantId, config.bucketPrefix);
}

export async function headTenantBucket(
  client: import('@aws-sdk/client-s3').S3Client,
  bucket: string,
): Promise<boolean> {
  const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status === 404 || name === 'NotFound' || name === 'NoSuchBucket') {
      return false;
    }
    throw error;
  }
}

export async function createTenantBucket(
  client: import('@aws-sdk/client-s3').S3Client,
  bucket: string,
): Promise<void> {
  const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status !== 409 && name !== 'BucketAlreadyOwnedByYou') {
      throw error;
    }
  }
}

export type EnsureSharedBucketInput = {
  bucketName: string;
  config: R2Config;
  adminClient?: import('@aws-sdk/client-s3').S3Client;
};

export async function ensureSharedBucket(
  input: EnsureSharedBucketInput,
): Promise<EnsureBucketResult> {
  return ensureTenantBucketByName(input);
}

export async function ensureTenantBucketByName(input: {
  bucketName: string;
  config: R2Config;
  adminClient?: import('@aws-sdk/client-s3').S3Client;
}): Promise<EnsureBucketResult> {
  const bucket = input.bucketName.trim();
  const adminClient = input.adminClient ?? createR2AdminClient(input.config);

  const exists = await headTenantBucket(adminClient, bucket);
  if (!exists) {
    await createTenantBucket(adminClient, bucket);
  }

  // Reconciliar fora do `if` é o ponto: a política vivia dentro da criação, então bucket já
  // existente nunca a recebia — nem o compartilhado criado à mão, nem nenhum depois de uma troca
  // de domínio. `ensureBucketCors` tem cache por processo, então isto não custa rede por upload.
  const cors = await ensureBucketCors(adminClient, bucket);

  logger.info('r2 bucket ready', {
    bucket,
    status: exists ? 'exists' : 'created',
    corsApplied: cors.applied,
  });

  return { bucket, created: !exists, corsPolicyHash: cors.policyHash };
}

/** @deprecated Prefer ensureTenantBucketByName com bucketName explícito do registry. */
export async function ensureTenantBucket(
  input: EnsureTenantBucketInput,
): Promise<EnsureBucketResult> {
  const bucket = input.bucketName?.trim() || resolveTenantBucketName(input.tenantId, input.config);
  return ensureTenantBucketByName({
    bucketName: bucket,
    config: input.config,
    adminClient: input.adminClient,
  });
}

export type EnsureBucketForScopeInput = {
  bucketMode: 'per_tenant' | 'shared';
  bucketName: string;
  tenantId: string;
  config: R2Config;
  adminClient?: import('@aws-sdk/client-s3').S3Client;
};

export async function ensureBucketForStorageScope(
  input: EnsureBucketForScopeInput,
): Promise<EnsureBucketResult> {
  if (input.bucketMode === 'shared') {
    return ensureSharedBucket({
      bucketName: input.bucketName,
      config: input.config,
      adminClient: input.adminClient,
    });
  }

  return ensureTenantBucketByName({
    bucketName: input.bucketName,
    config: input.config,
    adminClient: input.adminClient,
  });
}
