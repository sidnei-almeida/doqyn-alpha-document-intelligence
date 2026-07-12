import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import type { MongoDocument, MongoDocumentVersion } from '../../db/types.js';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { storeUploadedDocumentFile } from '../documentFileService.js';
import {
  enqueueScheduledDocumentPreview,
  scheduleDocumentPreviewForVersion,
} from '../preview/documentPreviewScheduling.js';
import { isStorageConfigured, getStorageProvider } from '../../storage/index.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { resolveStorageFileNames } from '../../utils/resolveStorageFileNames.js';
import {
  nextMajorVersionLabel,
  parseMajorVersionNumber,
} from '../../utils/versionLabelUtils.js';
import { logger } from '../../utils/logger.js';
import { buildDocumentMutationFields } from '../../utils/documentMutationFields.js';
import { resolveDocumentOwnerName } from '../../utils/userDisplayName.js';

export function buildSignedDisplayFileName(fileName: string): string {
  const trimmed = fileName.trim() || 'documento.pdf';
  if (/\.pdf$/i.test(trimmed)) {
    return trimmed.replace(/\.pdf$/i, '-assinado.pdf');
  }
  return `${trimmed}-assinado.pdf`;
}

async function resolvePdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch {
    return 1;
  }
}

export async function promoteSignedPdfToDocumentVersion(input: {
  tenantId: string;
  documentId: string;
  sourceVersion: MongoDocumentVersion;
  doc: MongoDocument;
  signedPdfBuffer: Buffer;
  signedPdfHashSha256: string;
  signatureRequestId: string;
  signatureId: string;
  promotedByUserId: string;
  storageScope: TenantStorageScope;
}): Promise<{
  versionId: string;
  versionLabel: string;
  finalFileName: string;
  storageStatus: 'stored' | 'pending';
}> {
  if (!isStorageConfigured()) {
    throw new ServiceError(
      'Storage não configurado para promover versão assinada.',
      'SIGNATURE_VERSION_STORAGE_UNAVAILABLE',
      503,
    );
  }

  const now = new Date();
  const versionId = `ver_${randomUUID()}`;
  const versionLabel = nextMajorVersionLabel(
    input.doc.currentVersionLabel ?? input.sourceVersion.versionLabel,
  );
  const versionNumber = parseMajorVersionNumber(versionLabel);
  const versionCount = (input.doc.versionCount ?? 1) + 1;
  const signedDisplayName = buildSignedDisplayFileName(
    input.sourceVersion.finalFileName || input.doc.currentFileName || 'documento.pdf',
  );

  const resolvedNames = resolveStorageFileNames({
    originalFileName: signedDisplayName,
    aiSuggestedFileName: signedDisplayName,
    finalFileName: signedDisplayName,
    namingMode: 'original',
    documentId: input.documentId,
    versionLabel,
  });

  let versionStorage = await storeUploadedDocumentFile({
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionId,
    buffer: input.signedPdfBuffer,
    mimeType: 'application/pdf',
    originalFileName: signedDisplayName,
    storageFileName: resolvedNames.storageFileName,
    storageScope: input.storageScope,
  });

  const storageStatus =
    versionStorage.primary.status === 'stored' && versionStorage.primary.objectKey
      ? 'stored'
      : 'pending';

  const previewResult = await scheduleDocumentPreviewForVersion({
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionId,
    contentType: 'application/pdf',
    storageScope: input.storageScope,
    primary: versionStorage.primary,
    previewStorageFileName: resolvedNames.previewStorageFileName,
    ownerUserId: input.promotedByUserId,
  });

  versionStorage = {
    ...versionStorage,
    preview: previewResult.slot,
  };

  const pageCount = await resolvePdfPageCount(input.signedPdfBuffer);
  const { documentVersions, documents } = await getTenantCollections(input.tenantId);

  const version: MongoDocumentVersion = {
    ...input.sourceVersion,
    _id: versionId,
    documentId: input.documentId,
    versionNumber,
    versionLabel,
    previousVersionId: input.sourceVersion._id,
    originalFileName: signedDisplayName,
    recommendedFileName: signedDisplayName,
    aiSuggestedFileName: signedDisplayName,
    selectedFileName: signedDisplayName,
    finalFileName: resolvedNames.finalFileName,
    namingMode: 'original',
    storageFileName: resolvedNames.storageFileName,
    previewStorageFileName: resolvedNames.previewStorageFileName,
    file: {
      mimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: input.signedPdfBuffer.length,
      sha256: input.signedPdfHashSha256,
      pageCount,
    },
    storage: versionStorage,
    previewManifest: previewResult.previewManifest ?? input.sourceVersion.previewManifest,
    review: {
      ...input.sourceVersion.review,
      reviewedBy: input.promotedByUserId,
      reviewedAt: now,
    },
    createdBy: input.promotedByUserId,
    createdAt: now,
  };

  try {
    const promotedByName = await resolveDocumentOwnerName({
      tenantId: input.tenantId,
      ownerUserId: input.promotedByUserId,
    });
    const mutationFields = buildDocumentMutationFields({
      actorUserId: input.promotedByUserId,
      actorDisplayName: promotedByName,
      now,
    });

    await documentVersions.insertOne(version);
    await documents.updateOne(
      { _id: input.documentId },
      {
        $set: {
          currentVersionId: versionId,
          currentVersionLabel: versionLabel,
          versionCount,
          currentFileName: resolvedNames.finalFileName,
          signatureStatus: 'signed',
          ...mutationFields,
        },
      },
    );

    if (previewResult.asyncQueued) {
      await enqueueScheduledDocumentPreview({
        tenantId: input.tenantId,
        documentId: input.documentId,
        versionId,
        contentType: 'application/pdf',
        storageScope: input.storageScope,
        primary: versionStorage.primary,
        previewStorageFileName: resolvedNames.previewStorageFileName,
        ownerUserId: input.promotedByUserId,
      });
    }
  } catch (error) {
    const objectKey = versionStorage.primary.objectKey;
    if (objectKey) {
      try {
        const provider = getStorageProvider();
        await provider?.deleteDocumentVersion?.(
          objectKey,
          input.tenantId,
          versionStorage.primary.bucketAlias,
          input.storageScope,
        );
      } catch (cleanupError) {
        logger.warn('Falha ao limpar versão assinada após erro de persistência', {
          documentId: input.documentId,
          versionId,
          signatureId: input.signatureId,
          message: cleanupError instanceof Error ? cleanupError.message : 'unknown',
        });
      }
    }
    throw error;
  }

  logger.info('Versão assinada promovida para documento', {
    documentId: input.documentId,
    versionId,
    versionLabel,
    signatureRequestId: input.signatureRequestId,
    signatureId: input.signatureId,
    storageStatus,
  });

  return {
    versionId,
    versionLabel,
    finalFileName: resolvedNames.finalFileName,
    storageStatus,
  };
}
