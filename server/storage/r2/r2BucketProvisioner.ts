import {
  CreateBucketCommand,
  HeadBucketCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { R2Config } from '../storageConfig.js';
import { logger } from '../../utils/logger.js';
import { createR2AdminClient } from './r2Clients.js';
import { getTenantBucketName } from './r2BucketNaming.js';

export type EnsureTenantBucketInput = {
  tenantId: string;
  config: R2Config;
  adminClient?: S3Client;
};

export function resolveTenantBucketName(tenantId: string, config: R2Config): string {
  return getTenantBucketName(tenantId, {
    bucketPrefix: config.bucketPrefix,
    bucketMode: config.bucketMode,
    defaultBucket: config.defaultBucket,
  });
}

export async function headTenantBucket(client: S3Client, bucket: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status === 404 || name === 'NotFound' || name === 'NoSuchBucket') {
      return false;
    }
    throw error;
  }
}

export async function createTenantBucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status === 409 || name === 'BucketAlreadyOwnedByYou') {
      return;
    }
    throw error;
  }
}

export async function ensureTenantBucket(
  input: EnsureTenantBucketInput,
): Promise<{ bucket: string; created: boolean }> {
  const bucket = resolveTenantBucketName(input.tenantId, input.config);
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
