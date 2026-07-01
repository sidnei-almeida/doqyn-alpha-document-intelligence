import { getStorageConfig } from './storageConfig.js';
import { createLocalStorageProvider } from './localStorageProvider.js';
import { createR2StorageProvider } from './r2/r2StorageProvider.js';
import type { StorageProvider } from './storageProvider.js';

let cachedProvider: StorageProvider | null | undefined;

export function getStorageProvider(): StorageProvider | null {
  if (cachedProvider !== undefined) {
    return cachedProvider;
  }

  const config = getStorageConfig();

  if (config.provider === 'r2' && config.r2) {
    cachedProvider = createR2StorageProvider(config);
    return cachedProvider;
  }

  if (config.provider === 'local') {
    cachedProvider = createLocalStorageProvider(config);
    return cachedProvider;
  }

  cachedProvider = null;
  return null;
}

export function resetStorageProviderCache(): void {
  cachedProvider = undefined;
}
