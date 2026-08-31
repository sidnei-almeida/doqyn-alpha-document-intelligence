import type { R2Config } from '../storageConfig.js';
import { logger } from '../../utils/logger.js';
import { createR2AdminClient } from './r2Clients.js';
import { buildLegacyTenantBucketName } from './r2BucketNaming.js';

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

/**
 * Libera o navegador a falar direto com o bucket.
 *
 * O arquivo não passa pela API: o cliente recebe uma URL assinada e faz `PUT` no R2. Sem política
 * de CORS o navegador nem chega a tentar — barra no preflight, e o upload falha com
 * `ERR_FAILED` sem nada nos logs do servidor, porque requisição nenhuma chegou.
 *
 * Isto ficou anos invisível porque os buckets em uso foram criados à mão, e configurados à mão
 * junto. O primeiro bucket nascido do código apareceu quando a base foi zerada, e nasceu mudo.
 *
 * A origem sai de `PUBLIC_APP_URL`/`DOQYN_PUBLIC_APP_URL`: liberar `*` deixaria qualquer site
 * emitir upload com uma URL assinada que vazasse.
 */
async function applyBucketCors(
  client: import('@aws-sdk/client-s3').S3Client,
  bucket: string,
): Promise<void> {
  const origin = (process.env.DOQYN_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '')
    .trim()
    .replace(/\/$/, '');

  const allowed = [origin, 'http://localhost:5173'].filter(Boolean);
  if (allowed.length === 0) return;

  const { PutBucketCorsCommand } = await import('@aws-sdk/client-s3');
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowed,
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            // O `ETag` é o que o cliente lê para confirmar que o corpo chegou inteiro.
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
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

  // Fora do try de criação de propósito: bucket que já existia também precisa da política, senão
  // os criados antes desta correção seguiriam mudos para sempre.
  await applyBucketCors(client, bucket);
}

export type EnsureSharedBucketInput = {
  bucketName: string;
  config: R2Config;
  adminClient?: import('@aws-sdk/client-s3').S3Client;
};

export async function ensureSharedBucket(
  input: EnsureSharedBucketInput,
): Promise<{ bucket: string; created: boolean }> {
  const bucket = input.bucketName.trim();
  const adminClient = input.adminClient ?? createR2AdminClient(input.config);

  const exists = await headTenantBucket(adminClient, bucket);
  if (exists) {
    logger.info('r2 shared bucket ready', { bucket, status: 'exists' });
    return { bucket, created: false };
  }

  await createTenantBucket(adminClient, bucket);
  logger.info('r2 shared bucket ready', { bucket, status: 'created' });
  return { bucket, created: true };
}

export async function ensureTenantBucketByName(input: {
  bucketName: string;
  config: R2Config;
  adminClient?: import('@aws-sdk/client-s3').S3Client;
}): Promise<{ bucket: string; created: boolean }> {
  const bucket = input.bucketName.trim();
  const adminClient = input.adminClient ?? createR2AdminClient(input.config);

  const exists = await headTenantBucket(adminClient, bucket);
  if (exists) {
    logger.info('r2 bucket ready', { bucket, status: 'exists' });
    return { bucket, created: false };
  }

  await createTenantBucket(adminClient, bucket);
  logger.info('r2 bucket ready', { bucket, status: 'created' });
  return { bucket, created: true };
}

/** @deprecated Prefer ensureTenantBucketByName com bucketName explícito do registry. */
export async function ensureTenantBucket(
  input: EnsureTenantBucketInput,
): Promise<{ bucket: string; created: boolean }> {
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
): Promise<{ bucket: string; created: boolean }> {
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
