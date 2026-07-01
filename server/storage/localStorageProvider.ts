import { access, constants, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageConfig } from './storageConfig.js';
import {
  buildDocumentVersionStorageKey,
  buildLegacyAnalysisStagingKey,
  resolveStorageAbsolutePath,
  sanitizeFileExtension,
} from './storageKeys.js';
import type {
  ReadDocumentVersionResult,
  StagingCapableStorageProvider,
  StoreDocumentVersionInput,
  StoredDocumentVersion,
} from './storageProvider.js';
import { ServiceError } from '../utils/serviceErrors.js';

export class LocalStorageProvider implements StagingCapableStorageProvider {
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

  async readDocumentVersion(
    storageKey: string,
    tenantId?: string,
    bucketAlias?: string | null,
  ): Promise<ReadDocumentVersionResult> {
    void tenantId;
    void bucketAlias;
    await this.ensureReady();
    const absolutePath = resolveStorageAbsolutePath(this.root, storageKey);
    const buffer = await readFile(absolutePath);

    return {
      buffer,
      storageKey,
      sizeBytes: buffer.length,
    };
  }

  async deleteDocumentVersion(
    storageKey: string,
    tenantId?: string,
    bucketAlias?: string | null,
  ): Promise<void> {
    void tenantId;
    void bucketAlias;
    await this.ensureReady();
    const absolutePath = resolveStorageAbsolutePath(this.root, storageKey);
    await rm(absolutePath, { force: true });
  }

  async storeStagingFile(input: {
    tenantId: string;
    jobId: string;
    buffer: Buffer;
    mimeType: string;
    originalFileName?: string;
    ownerUserId?: string;
  }): Promise<string> {
    await this.ensureReady();

    if (input.buffer.length > this.config.maxUploadBytes) {
      throw new ServiceError(
        `Arquivo excede o limite de ${Math.floor(this.config.maxUploadBytes / (1024 * 1024))} MB.`,
        'FILE_TOO_LARGE',
        413,
      );
    }

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType,
    });

    const ownerUserId = input.ownerUserId?.trim() || 'unknown';
    const stagingKey = buildLegacyAnalysisStagingKey({
      tenantId: input.tenantId,
      ownerUserId,
      jobId: input.jobId,
      extension,
    });

    const absolutePath = resolveStorageAbsolutePath(this.root, stagingKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    try {
      await writeFile(absolutePath, input.buffer);
    } catch (error) {
      await rm(absolutePath, { force: true }).catch(() => undefined);
      throw error;
    }

    return stagingKey;
  }

  async loadStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    ownerUserId?: string;
  }): Promise<Buffer> {
    await this.ensureReady();

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType ?? 'application/pdf',
    });

    const ownerUserId = input.ownerUserId?.trim() || 'unknown';
    const stagingKey = buildLegacyAnalysisStagingKey({
      tenantId: input.tenantId,
      ownerUserId,
      jobId: input.jobId,
      extension,
    });

    const absolutePath = resolveStorageAbsolutePath(this.root, stagingKey);

    try {
      return await readFile(absolutePath);
    } catch {
      throw new ServiceError(
        'Arquivo original não encontrado. Refaça a análise e confirme novamente.',
        'STAGING_FILE_NOT_FOUND',
        400,
      );
    }
  }

  async deleteStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    ownerUserId?: string;
  }): Promise<void> {
    await this.ensureReady();

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType ?? 'application/pdf',
    });

    const ownerUserId = input.ownerUserId?.trim() || 'unknown';
    const stagingKey = buildLegacyAnalysisStagingKey({
      tenantId: input.tenantId,
      ownerUserId,
      jobId: input.jobId,
      extension,
    });

    const absolutePath = resolveStorageAbsolutePath(this.root, stagingKey);
    await rm(absolutePath, { force: true }).catch(() => undefined);
  }
}

export function createLocalStorageProvider(config: StorageConfig): LocalStorageProvider {
  return new LocalStorageProvider(config);
}
