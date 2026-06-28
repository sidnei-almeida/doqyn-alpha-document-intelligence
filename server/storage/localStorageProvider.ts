import { access, constants, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageConfig } from './storageConfig.js';
import {
  buildDocumentVersionStorageKey,
  resolveStorageAbsolutePath,
  sanitizeFileExtension,
} from './storageKeys.js';
import type {
  ReadDocumentVersionResult,
  StorageProvider,
  StoreDocumentVersionInput,
  StoredDocumentVersion,
} from './storageProvider.js';
import { ServiceError } from '../utils/serviceErrors.js';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  private get root(): string {
    return this.config.localRoot;
  }

  async ensureReady(): Promise<void> {
    if (!this.root) {
      throw new ServiceError(
        'LOCAL_STORAGE_ROOT não configurado.',
        'STORAGE_ROOT_MISSING',
        500,
      );
    }

    try {
      await access(this.root, constants.F_OK);
    } catch {
      throw new ServiceError(
        'LOCAL_STORAGE_ROOT não existe.',
        'STORAGE_ROOT_NOT_FOUND',
        500,
      );
    }

    try {
      await access(this.root, constants.W_OK);
    } catch {
      throw new ServiceError(
        'LOCAL_STORAGE_ROOT não é gravável.',
        'STORAGE_ROOT_NOT_WRITABLE',
        500,
      );
    }
  }

  async storeDocumentVersion(input: StoreDocumentVersionInput): Promise<StoredDocumentVersion> {
    await this.ensureReady();

    if (input.buffer.length > this.config.maxUploadBytes) {
      throw new ServiceError(
        `Arquivo excede o limite de ${Math.floor(this.config.maxUploadBytes / (1024 * 1024))} MB.`,
        'FILE_TOO_LARGE',
        413,
      );
    }

    const extension = sanitizeFileExtension({
      extension: input.extension,
      mimeType: input.mimeType,
    });

    const storageKey = buildDocumentVersionStorageKey({
      tenantId: input.tenantId,
      documentId: input.documentId,
      versionId: input.versionId,
      extension,
    });

    const absolutePath = resolveStorageAbsolutePath(this.root, storageKey);
    const directory = path.dirname(absolutePath);

    await mkdir(directory, { recursive: true });

    try {
      await writeFile(absolutePath, input.buffer);
    } catch (error) {
      await rm(absolutePath, { force: true }).catch(() => undefined);
      throw error;
    }

    return {
      storageKey,
      sizeBytes: input.buffer.length,
      provider: 'local',
    };
  }

  async readDocumentVersion(storageKey: string): Promise<ReadDocumentVersionResult> {
    await this.ensureReady();
    const absolutePath = resolveStorageAbsolutePath(this.root, storageKey);
    const buffer = await readFile(absolutePath);

    return {
      buffer,
      storageKey,
      sizeBytes: buffer.length,
    };
  }

  async deleteDocumentVersion(storageKey: string): Promise<void> {
    await this.ensureReady();
    const absolutePath = resolveStorageAbsolutePath(this.root, storageKey);
    await rm(absolutePath, { force: true });
  }
}

export function createLocalStorageProvider(config: StorageConfig): LocalStorageProvider {
  return new LocalStorageProvider(config);
}
