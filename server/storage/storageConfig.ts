export type StorageProviderName = 'local' | 'r2' | 'none';

export type R2BucketMode = 'per_tenant' | 'shared';

export type R2Config = {
  accountId: string;
  endpoint: string;
  region: string;
  bucketMode: R2BucketMode;
  defaultBucket: string;
  bucketPrefix: string;
  keyPrefix: string;
  runtimeAccessKeyId: string;
  runtimeSecretAccessKey: string;
  adminAccessKeyId: string;
  adminSecretAccessKey: string;
  adminApiToken: string;
};

export type StorageConfig = {
  provider: StorageProviderName;
  localRoot: string;
  maxUploadBytes: number;
  r2: R2Config | null;
};

const DEFAULT_MAX_UPLOAD_MB = 25;

function readTrimmed(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function resolveProviderName(raw: string): StorageProviderName {
  if (raw === 'local') return 'local';
  if (raw === 'r2') return 'r2';
  return 'none';
}

export function getR2ConfigFromEnv(): R2Config | null {
  const accountId = readTrimmed('R2_ACCOUNT_ID');
  const endpoint = readTrimmed('R2_ENDPOINT');
  const region = readTrimmed('R2_REGION') || 'auto';
  const bucketMode = readTrimmed('R2_BUCKET_MODE') === 'per_tenant' ? 'per_tenant' : 'shared';
  const defaultBucket = readTrimmed('R2_DEFAULT_BUCKET') || readTrimmed('R2_BUCKET');
  const bucketPrefix = readTrimmed('R2_BUCKET_PREFIX');
  const keyPrefix = readTrimmed('R2_KEY_PREFIX') || 'documents';

  if (!accountId || !endpoint || !defaultBucket) {
    return null;
  }

  return {
    accountId,
    endpoint,
    region,
    bucketMode,
    defaultBucket,
    bucketPrefix,
    keyPrefix,
    runtimeAccessKeyId: readTrimmed('R2_ACCESS_KEY_ID'),
    runtimeSecretAccessKey: readTrimmed('R2_SECRET_ACCESS_KEY'),
    adminAccessKeyId: readTrimmed('R2_ADMIN_ACCESS_KEY_ID'),
    adminSecretAccessKey: readTrimmed('R2_ADMIN_SECRET_ACCESS_KEY'),
    adminApiToken: readTrimmed('CLOUDFLARE_R2_ADMIN_API_TOKEN'),
  };
}

export function validateR2Endpoint(endpoint: string, accountId?: string): boolean {
  if (!endpoint) return false;
  if (/\/[^/]+\/?$/.test(endpoint.replace(/^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\/?$/i, ''))) {
    return false;
  }
  if (!/^https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/?$/i.test(endpoint)) {
    return false;
  }
  if (accountId && !endpoint.includes(accountId)) {
    return false;
  }
  return true;
}

export function getStorageConfig(): StorageConfig {
  const rawProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase() || 'none';
  const provider = resolveProviderName(rawProvider);
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);
  const r2 = provider === 'r2' ? getR2ConfigFromEnv() : null;

  return {
    provider,
    localRoot: process.env.LOCAL_STORAGE_ROOT?.trim() || '',
    maxUploadBytes:
      Number.isFinite(maxUploadMb) && maxUploadMb > 0
        ? maxUploadMb * 1024 * 1024
        : DEFAULT_MAX_UPLOAD_MB * 1024 * 1024,
    r2,
  };
}

export function isLocalStorageEnabled(): boolean {
  return getStorageConfig().provider === 'local';
}

export function isR2StorageEnabled(): boolean {
  return getStorageConfig().provider === 'r2';
}

export function isR2StorageConfigured(): boolean {
  const config = getStorageConfig();
  if (config.provider !== 'r2' || !config.r2) return false;

  const { r2 } = config;
  return Boolean(
    r2.runtimeAccessKeyId &&
      r2.runtimeSecretAccessKey &&
      validateR2Endpoint(r2.endpoint, r2.accountId) &&
      r2.defaultBucket,
  );
}
