import { S3Client } from '@aws-sdk/client-s3';
import type { R2Config } from '../storageConfig.js';
import { validateR2Endpoint } from '../storageConfig.js';
import { ServiceError } from '../../utils/serviceErrors.js';

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

function assertEndpoint(endpoint: string, accountId?: string): string {
  const normalized = normalizeEndpoint(endpoint);
  if (!validateR2Endpoint(normalized, accountId)) {
    throw new ServiceError(
      'R2_ENDPOINT inválido. Use https://<ACCOUNT_ID>.r2.cloudflarestorage.com sem sufixo de bucket.',
      'R2_ENDPOINT_INVALID',
      500,
    );
  }
  return normalized;
}

function buildS3Client(
  config: R2Config,
  credentials: { accessKeyId: string; secretAccessKey: string },
): S3Client {
  const endpoint = assertEndpoint(config.endpoint, config.accountId);
  const region = config.region?.trim() || 'auto';

  return new S3Client({
    region,
    endpoint,
    credentials,
    forcePathStyle: true,
  });
}

export function createR2RuntimeClient(config: R2Config): S3Client {
  if (!config.runtimeAccessKeyId || !config.runtimeSecretAccessKey) {
    throw new ServiceError(
      'Credenciais runtime R2 ausentes (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).',
      'R2_RUNTIME_CREDENTIALS_MISSING',
      500,
    );
  }

  return buildS3Client(config, {
    accessKeyId: config.runtimeAccessKeyId,
    secretAccessKey: config.runtimeSecretAccessKey,
  });
}

export function createR2AdminClient(config: R2Config): S3Client {
  if (!config.adminAccessKeyId || !config.adminSecretAccessKey) {
    throw new ServiceError(
      'Credenciais admin R2 ausentes (R2_ADMIN_ACCESS_KEY_ID / R2_ADMIN_SECRET_ACCESS_KEY).',
      'R2_ADMIN_CREDENTIALS_MISSING',
      500,
    );
  }

  return buildS3Client(config, {
    accessKeyId: config.adminAccessKeyId,
    secretAccessKey: config.adminSecretAccessKey,
  });
}
