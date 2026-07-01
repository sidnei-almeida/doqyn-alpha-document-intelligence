import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';

export type StorageProviderName = 'local' | 'r2';

export type StoreDocumentVersionInput = {
  tenantId: string;
  documentId: string;
  versionId: string;
  buffer: Buffer;
  mimeType: string;
  extension?: string;
  storageScope?: TenantStorageScope;
};

export type StoredDocumentVersion = {
  storageKey: string;
  sizeBytes: number;
  provider: StorageProviderName;
  bucket?: string;
  etag?: string;
  contentType?: string;
};

export type ReadDocumentVersionResult = {
  buffer: Buffer;
  storageKey: string;
  sizeBytes: number;
  bucket?: string;
  etag?: string;
  contentType?: string;
};

export interface StorageProvider {
  readonly name: StorageProviderName;
  ensureReady(): Promise<void>;
  storeDocumentVersion(input: StoreDocumentVersionInput): Promise<StoredDocumentVersion>;
  readDocumentVersion(
    storageKey: string,
    tenantId: string,
    bucketAlias?: string | null,
  ): Promise<ReadDocumentVersionResult>;
  deleteDocumentVersion(
    storageKey: string,
    tenantId: string,
    bucketAlias?: string | null,
  ): Promise<void>;
}

export interface StagingCapableStorageProvider extends StorageProvider {
  storeStagingFile(input: {
    tenantId: string;
    jobId: string;
    buffer: Buffer;
    mimeType: string;
    originalFileName?: string;
    ownerUserId?: string;
    storageScope?: TenantStorageScope;
  }): Promise<string>;
  loadStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    ownerUserId?: string;
    storageScope?: TenantStorageScope;
  }): Promise<Buffer>;
  deleteStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    ownerUserId?: string;
    storageScope?: TenantStorageScope;
  }): Promise<void>;
}

export function isStagingCapableProvider(
  provider: StorageProvider,
): provider is StagingCapableStorageProvider {
  return (
    typeof (provider as StagingCapableStorageProvider).storeStagingFile === 'function' &&
    typeof (provider as StagingCapableStorageProvider).loadStagingFile === 'function'
  );
}
