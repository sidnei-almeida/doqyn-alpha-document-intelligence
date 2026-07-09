import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentVersion, MongoPreviewStorageSlot } from '../db/types.js';
import {
  loadMemberDocumentGroupIds,
  resolveDocumentPermissions,
  assertCanUpdateDocument,
} from '../tenancy/documentAccess.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { normalizeVersionLabel, parseMajorVersionNumber } from '../utils/versionLabelUtils.js';

function mapPreviewStatus(
  preview?: MongoPreviewStorageSlot | null,
): 'ready' | 'failed' | 'skipped' | 'missing' {
  if (!preview) return 'missing';
  if (preview.status === 'ready') return 'ready';
  if (preview.status === 'failed') return 'failed';
  if (
    preview.status === 'skipped' ||
    preview.status === 'pending' ||
    preview.status === 'processing'
  ) {
    return 'skipped';
  }
  return 'missing';
}

export type DocumentVersionListItem = {
  versionId: string;
  versionNumber: number;
  versionLabel: string;
  finalFileName: string;
  originalFileName: string;
  storageFileName?: string;
  previewStorageFileName?: string;
  createdAt: Date;
  createdBy?: string;
  previousVersionId: string | null;
  isCurrent: boolean;
  preview: {
    status: 'ready' | 'failed' | 'skipped' | 'missing';
  };
  file: {
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    pageCount?: number;
  };
};

export async function listDocumentVersions(input: {
  documentId: string;
  tenantId: string;
  ownerUserId: string;
  user: AuthUser;
  membershipId?: string;
}): Promise<{
  documentId: string;
  currentVersionId: string;
  currentVersionLabel: string;
  versionCount: number;
  versions: DocumentVersionListItem[];
}> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Persistência indisponível.', 'MONGODB_NOT_CONFIGURED', 503);
  }

  const { documents, documentVersions, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
    membershipId: input.membershipId,
  });

  const doc = await documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(storage),
    deletedAt: { $in: [null, undefined] },
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: input.tenantId,
    userId: input.user.id,
    membershipId: input.membershipId,
  });
  const permissions = resolveDocumentPermissions(
    input.user,
    doc as MongoDocument,
    memberGroupIds,
  );

  if (!permissions.canPreview && !permissions.canDownload) {
    throw new ServiceError(
      'Você não tem permissão para visualizar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }

  const versions = await documentVersions
    .find({
      documentId: input.documentId,
      ...tenantScopeFilterFromContext(storage),
    } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();

  const mongoDoc = doc as MongoDocument & {
    currentVersionLabel?: string;
    versionCount?: number;
  };

  const currentVersionLabel = normalizeVersionLabel(
    mongoDoc.currentVersionLabel ??
      versions.find((v) => String(v._id) === mongoDoc.currentVersionId)?.versionLabel,
  );

  const mapped: DocumentVersionListItem[] = versions.map((version) => {
    const v = version as MongoDocumentVersion;
    const preview = v.storage?.preview ?? null;
    return {
      versionId: String(v._id),
      versionNumber: v.versionNumber ?? parseMajorVersionNumber(v.versionLabel),
      versionLabel: normalizeVersionLabel(v.versionLabel),
      finalFileName: v.finalFileName ?? v.originalFileName,
      originalFileName: v.originalFileName,
      storageFileName: v.storageFileName,
      previewStorageFileName: v.previewStorageFileName,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      previousVersionId: v.previousVersionId ?? null,
      isCurrent: String(v._id) === mongoDoc.currentVersionId,
      preview: {
        status: mapPreviewStatus(preview),
      },
      file: {
        mimeType: v.file?.mimeType ?? 'application/pdf',
        sizeBytes: v.file?.sizeBytes ?? 0,
        sha256: v.file?.sha256 ?? '',
        pageCount: v.file?.pageCount,
      },
    };
  });

  return {
    documentId: input.documentId,
    currentVersionId: mongoDoc.currentVersionId,
    currentVersionLabel,
    versionCount: mongoDoc.versionCount ?? mapped.length,
    versions: mapped,
  };
}

export async function getDocumentVersion(input: {
  documentId: string;
  versionId: string;
  tenantId: string;
  ownerUserId: string;
  user: AuthUser;
  membershipId?: string;
}): Promise<DocumentVersionListItem> {
  const listed = await listDocumentVersions({
    documentId: input.documentId,
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    user: input.user,
    membershipId: input.membershipId,
  });

  const version = listed.versions.find((item) => item.versionId === input.versionId);
  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  return version;
}

export async function assertCanUpdateExistingDocument(input: {
  documentId: string;
  tenantId: string;
  ownerUserId: string;
  user: AuthUser;
  membershipId?: string;
}): Promise<MongoDocument> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Persistência indisponível.', 'MONGODB_NOT_CONFIGURED', 503);
  }

  const { documents, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
    membershipId: input.membershipId,
  });

  const doc = await documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(storage),
    deletedAt: { $in: [null, undefined] },
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: input.tenantId,
    userId: input.user.id,
    membershipId: input.membershipId,
  });
  const permissions = resolveDocumentPermissions(
    input.user,
    doc as MongoDocument,
    memberGroupIds,
  );
  assertCanUpdateDocument(permissions);

  if ((doc as MongoDocument).status === 'archived') {
    throw new ServiceError(
      'Documento arquivado não pode receber nova versão.',
      'DOCUMENT_ARCHIVED',
      409,
    );
  }

  return doc as MongoDocument;
}