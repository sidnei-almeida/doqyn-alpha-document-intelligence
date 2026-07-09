import type { MongoDocumentVersion } from '../../db/types.js';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import { getStorageProvider } from '../../storage/index.js';
import {
  buildDocumentPreviewImageResolutionObjectKey,
  buildDocumentPreviewPageAssetObjectKey,
} from '../../storage/storageKeys.js';
import { logger } from '../../utils/logger.js';

export type VersionStoragePurgeResult = {
  versionId: string;
  deletedKeys: string[];
  failedKeys: Array<{ key: string; error: string }>;
};

function resolveObjectKey(
  slot: { objectKey?: string | null; status?: string } | undefined,
): string | null {
  if (!slot?.objectKey?.trim()) return null;
  if (slot.status === 'pending' || slot.status === 'skipped') return null;
  return slot.objectKey.trim();
}

async function tryDeleteKey(input: {
  tenantId: string;
  storageKey: string;
  bucketAlias?: string | null;
  storageScope?: TenantStorageScope;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider = getStorageProvider();
  if (!provider) {
    return { ok: false, error: 'Storage não configurado.' };
  }

  try {
    await provider.deleteDocumentVersion(
      input.storageKey,
      input.tenantId,
      input.bucketAlias,
      input.storageScope,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function collectManifestAssetKeys(
  version: MongoDocumentVersion,
  storageScope?: TenantStorageScope,
): string[] {
  const keys = new Set<string>();
  const manifest = version.previewManifest;
  if (!manifest) return [];

  const basePrefix = storageScope?.basePrefix;
  const documentId = version.documentId;
  const versionId = String(version._id);

  if (manifest.viewerType === 'pdf_pages' && manifest.pages?.length) {
    for (const page of manifest.pages) {
      if (page.previewObjectKey) keys.add(page.previewObjectKey);
      if (page.thumbnailObjectKey) keys.add(page.thumbnailObjectKey);

      const pageNum = page.page;
      if (Number.isInteger(pageNum) && pageNum >= 1) {
        keys.add(
          buildDocumentPreviewPageAssetObjectKey({
            documentId,
            versionId,
            pageNumber: pageNum,
            variant: 'page',
            basePrefix,
          }),
        );
        keys.add(
          buildDocumentPreviewPageAssetObjectKey({
            documentId,
            versionId,
            pageNumber: pageNum,
            variant: 'thumbnail',
            basePrefix,
          }),
        );
      }
    }
  }

  if (manifest.viewerType === 'image' && manifest.image?.resolutions?.length) {
    for (const resolution of manifest.image.resolutions) {
      if (resolution.objectKey) {
        keys.add(resolution.objectKey);
      } else if (
        resolution.label === 'thumbnail' ||
        resolution.label === 'small' ||
        resolution.label === 'medium' ||
        resolution.label === 'large'
      ) {
        const ext = manifest.mimeType?.includes('webp') ? 'webp' : 'png';
        keys.add(
          buildDocumentPreviewImageResolutionObjectKey({
            documentId,
            versionId,
            label: resolution.label as 'small' | 'medium' | 'large' | 'thumbnail',
            extension: ext,
            basePrefix,
          }),
        );
      }
    }
  }

  return [...keys];
}

export async function purgeDocumentVersionStorage(input: {
  tenantId: string;
  version: MongoDocumentVersion;
  storageScope?: TenantStorageScope;
}): Promise<VersionStoragePurgeResult> {
  const { tenantId, version, storageScope } = input;
  const versionId = String(version._id);
  const bucketAlias = version.storage?.primary?.bucketAlias ?? null;

  const candidateKeys = new Set<string>();

  const primaryKey = resolveObjectKey(version.storage?.primary);
  if (primaryKey) candidateKeys.add(primaryKey);

  const previewKey = resolveObjectKey(version.storage?.preview);
  if (previewKey) candidateKeys.add(previewKey);

  for (const key of collectManifestAssetKeys(version, storageScope)) {
    candidateKeys.add(key);
  }

  const deletedKeys: string[] = [];
  const failedKeys: Array<{ key: string; error: string }> = [];

  for (const storageKey of candidateKeys) {
    const result = await tryDeleteKey({
      tenantId,
      storageKey,
      bucketAlias,
      storageScope,
    });
    if (result.ok) {
      deletedKeys.push(storageKey);
    } else {
      failedKeys.push({ key: storageKey, error: result.error });
      logger.warn('Falha ao remover objeto R2 na purga', {
        tenantId,
        documentId: version.documentId,
        versionId,
        storageKey,
        error: result.error,
      });
    }
  }

  return { versionId, deletedKeys, failedKeys };
}

export async function purgeAllDocumentVersionStorage(input: {
  tenantId: string;
  versions: MongoDocumentVersion[];
  storageScope?: TenantStorageScope;
}): Promise<{
  results: VersionStoragePurgeResult[];
  hasFailures: boolean;
}> {
  const results: VersionStoragePurgeResult[] = [];

  for (const version of input.versions) {
    const result = await purgeDocumentVersionStorage({
      tenantId: input.tenantId,
      version,
      storageScope: input.storageScope,
    });
    results.push(result);
  }

  const hasFailures = results.some((result) => result.failedKeys.length > 0);
  return { results, hasFailures };
}
