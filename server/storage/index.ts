import type { MongoDocumentVersion } from '../db/types.js';
import {
  deleteAnalysisStaging,
  loadAnalysisStaging,
  storeAnalysisStaging,
} from './stagingStorage.js';
import {
  isLocalStorageEnabled,
  isR2StorageConfigured,
} from './storageConfig.js';
import { getStorageProvider, resetStorageProviderCache } from './getStorageProvider.js';
import type { StoreDocumentVersionInput, StoredDocumentVersion, StoreDocumentPreviewInput, StorePreviewAssetInput, StoredDocumentPreview } from './storageProvider.js';

export { getStorageProvider, resetStorageProviderCache };

export function buildVersionStorage(stored: StoredDocumentVersion): MongoDocumentVersion['storage'] {
  const now = new Date();

  if (stored.provider === 'r2') {
    return {
      primary: {
        provider: 'cloudflare_r2',
        status: 'stored',
        objectKey: stored.storageKey,
        bucketAlias: stored.bucket ?? null,
        storedAt: now,
      },
      backup: {
        provider: 'aws_s3',
        status: 'pending',
        objectKey: null,
        bucketAlias: null,
        storedAt: null,
      },
    };
  }

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

/** @deprecated use buildVersionStorage */
export const buildLocalVersionStorage = buildVersionStorage;

export async function persistDocumentVersionFile(
  input: StoreDocumentVersionInput,
): Promise<StoredDocumentVersion | null> {
  const provider = getStorageProvider();
  if (!provider) {
    return null;
  }

  return provider.storeDocumentVersion(input);
}

export async function persistDocumentPreviewFile(
  input: StoreDocumentPreviewInput,
): Promise<StoredDocumentPreview | null> {
  const provider = getStorageProvider();
  if (!provider) {
    return null;
  }

  return provider.storeDocumentPreview(input);
}

export async function persistPreviewAsset(
  input: StorePreviewAssetInput,
): Promise<StoredDocumentPreview | null> {
  const provider = getStorageProvider();
  if (!provider) {
    return null;
  }

  return provider.storePreviewAsset(input);
}

export function isStorageConfigured(): boolean {
  if (isR2StorageConfigured()) {
    return true;
  }
  return isLocalStorageEnabled();
}

export {
  deleteAnalysisStaging,
  loadAnalysisStaging,
  storeAnalysisStaging,
};
