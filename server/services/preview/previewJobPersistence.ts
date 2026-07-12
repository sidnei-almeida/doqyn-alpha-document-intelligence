import type { MongoDocumentVersion, MongoPreviewManifest, MongoPreviewStorageSlot } from '../../db/types.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';

export async function markDocumentPreviewProcessing(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
}): Promise<void> {
  const { documentVersions } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  await documentVersions.updateOne(
    { _id: input.versionId, documentId: input.documentId } as Record<string, unknown>,
    { $set: { 'storage.preview.status': 'processing' } },
  );
}

export async function applyDocumentPreviewResult(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  slot: MongoPreviewStorageSlot;
  previewManifest?: MongoPreviewManifest | null;
}): Promise<void> {
  const { documentVersions } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  const update: Record<string, unknown> = {
    'storage.preview': input.slot,
  };

  if (input.previewManifest) {
    update.previewManifest = input.previewManifest;
  }

  await documentVersions.updateOne(
    { _id: input.versionId, documentId: input.documentId } as Record<string, unknown>,
    { $set: update },
  );
}

export async function loadDocumentVersionForPreview(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
}): Promise<MongoDocumentVersion | null> {
  const { documentVersions } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  const version = await documentVersions.findOne({
    _id: input.versionId,
    documentId: input.documentId,
  } as Record<string, unknown>);

  return (version as MongoDocumentVersion | null) ?? null;
}
