import type { MongoDocumentVersion } from '../db/types.js';
import {
  deleteAnalysisStaging,
  loadAnalysisStaging,
  storeAnalysisStaging,
} from './stagingStorage.js';
import { getStorageConfig, isLocalStorageEnabled } from './storageConfig.js';
import { createLocalStorageProvider } from './localStorageProvider.js';
import type { StorageProvider, StoreDocumentVersionInput, StoredDocumentVersion } from './storageProvider.js';

let cachedProvider: StorageProvider | null | undefined;

export function getStorageProvider(): StorageProvider | null {
  if (cachedProvider !== undefined) {
    return cachedProvider;
  }

  const config = getStorageConfig();
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

export function buildLocalVersionStorage(stored: StoredDocumentVersion): MongoDocumentVersion['storage'] {
  const now = new Date();
  return {
    primary: {
      provider: 'local',
      status: 'stored',
      objectKey: stored.storageKey,
      bucketAlias: null,
      storedAt: now,
    },
    backup: {
      provider: 'cloudflare_r2',
      status: 'pending',
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
  };
}

export async function persistDocumentVersionFile(
  input: StoreDocumentVersionInput,
): Promise<StoredDocumentVersion | null> {
  const provider = getStorageProvider();
  if (!provider) {
    return null;
  }

  return provider.storeDocumentVersion(input);
}

export function isStorageConfigured(): boolean {
  return isLocalStorageEnabled();
}

export {
  deleteAnalysisStaging,
  loadAnalysisStaging,
  storeAnalysisStaging,
};
