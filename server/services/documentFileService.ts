import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentVersion } from '../db/types.js';
import {
  buildLocalVersionStorage,
  getStorageProvider,
  persistDocumentVersionFile,
} from '../storage/index.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  assertCanAccessDocument,
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';

function buildPendingStorage(): MongoDocumentVersion['storage'] {
  return {
    primary: {
      provider: 'aws_s3',
      status: 'pending',
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
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

export async function storeUploadedDocumentFile(input: {
  tenantId: string;
  documentId: string;
  versionId: string;
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
}): Promise<MongoDocumentVersion['storage']> {
  const provider = getStorageProvider();
  if (!provider || input.buffer.length === 0) {
    return buildPendingStorage();
  }

  const extension = input.originalFileName.split('.').pop();
  const stored = await persistDocumentVersionFile({
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionId: input.versionId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    extension,
  });

  if (!stored) {
    return buildPendingStorage();
  }

  return buildLocalVersionStorage(stored);
}

export async function readDocumentVersionFile(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId?: string;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  storageKey: string;
}> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Arquivo não disponível.', 'FILE_NOT_FOUND', 404);
  }

  const { documents, documentVersions, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  const doc = await documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const resolvedVersionId = input.versionId ?? (doc as MongoDocument).currentVersionId;
  const version = await documentVersions.findOne({
    _id: resolvedVersionId,
    documentId: input.documentId,
    ...buildDocumentOwnershipFilter(storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  const storageKey = (version as MongoDocumentVersion).storage?.primary?.objectKey;
  if (!storageKey) {
    throw new ServiceError('Arquivo ainda não disponível.', 'FILE_NOT_STORED', 404);
  }

  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentVersion(storageKey);
  const versionDoc = version as MongoDocumentVersion;

  return {
    buffer: file.buffer,
    mimeType: versionDoc.file?.mimeType ?? 'application/octet-stream',
    fileName: versionDoc.finalFileName || versionDoc.originalFileName || 'documento',
    storageKey,
  };
}
