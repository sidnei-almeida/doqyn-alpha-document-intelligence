export type StorageProviderName = 'local' | 'none';

export type StorageConfig = {
  provider: StorageProviderName;
  localRoot: string;
  maxUploadBytes: number;
};

const DEFAULT_MAX_UPLOAD_MB = 25;

export function getStorageConfig(): StorageConfig {
  const rawProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase() || 'none';
  const provider: StorageProviderName = rawProvider === 'local' ? 'local' : 'none';
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);

  return {
    provider,
    localRoot: process.env.LOCAL_STORAGE_ROOT?.trim() || '',
    maxUploadBytes: Number.isFinite(maxUploadMb) && maxUploadMb > 0
      ? maxUploadMb * 1024 * 1024
      : DEFAULT_MAX_UPLOAD_MB * 1024 * 1024,
  };
}

export function isLocalStorageEnabled(): boolean {
  return getStorageConfig().provider === 'local';
}
