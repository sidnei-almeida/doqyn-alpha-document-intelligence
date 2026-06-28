export type StoreDocumentVersionInput = {
  tenantId: string;
  documentId: string;
  versionId: string;
  buffer: Buffer;
  mimeType: string;
  extension?: string;
};

export type StoredDocumentVersion = {
  storageKey: string;
  sizeBytes: number;
  provider: 'local';
};

export type ReadDocumentVersionResult = {
  buffer: Buffer;
  storageKey: string;
  sizeBytes: number;
};

export interface StorageProvider {
  readonly name: 'local';
  ensureReady(): Promise<void>;
  storeDocumentVersion(input: StoreDocumentVersionInput): Promise<StoredDocumentVersion>;
  readDocumentVersion(storageKey: string): Promise<ReadDocumentVersionResult>;
  deleteDocumentVersion(storageKey: string): Promise<void>;
}
