import type { NamingMode } from '../utils/resolveStorageFileNames.js';
import type { ResolvedStorageFileNames } from '../utils/resolveStorageFileNames.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { buildDocumentNameSnapshot } from './documentNameSnapshot.js';
import type { DocumentAuditEventInput } from './documentAuditTypes.js';

export function resolveFilenameUpdateBaseline(input: {
  namingMode: NamingMode;
  originalFileName: string;
  aiSuggestedFileName: string;
  recommendedFileName?: string;
  selectedFileName?: string;
  resolved: ResolvedStorageFileNames;
}): string {
  if (input.namingMode === 'manual') {
    return input.resolved.aiSuggestedFileName || input.originalFileName;
  }
  if (input.namingMode === 'original') {
    return input.originalFileName;
  }
  return input.resolved.aiSuggestedFileName || input.recommendedFileName || '';
}

export function shouldEmitFilenameUpdated(input: {
  namingMode: NamingMode;
  originalFileName: string;
  aiSuggestedFileName: string;
  recommendedFileName?: string;
  selectedFileName?: string;
  resolved: ResolvedStorageFileNames;
}): boolean {
  const baseline = resolveFilenameUpdateBaseline(input).trim();
  return Boolean(baseline) && baseline !== input.resolved.finalFileName;
}

export function buildFilenameUpdatedAuditEvent(input: {
  namingMode: NamingMode;
  originalFileName: string;
  aiSuggestedFileName: string;
  recommendedFileName?: string;
  selectedFileName?: string;
  resolved: ResolvedStorageFileNames;
  documentId: string;
  versionId: string;
  occurredAt: Date;
}): DocumentAuditEventInput | null {
  if (!shouldEmitFilenameUpdated(input)) {
    return null;
  }

  const beforeName = resolveFilenameUpdateBaseline(input);
  const documentNameSnapshot = buildDocumentNameSnapshot({
    finalFileName: input.resolved.finalFileName,
    storageFileName: input.resolved.storageFileName,
    previewStorageFileName: input.resolved.previewStorageFileName,
    aiSuggestedFileName: input.aiSuggestedFileName,
    recommendedFileName: input.recommendedFileName,
    originalFileName: input.originalFileName,
  });

  return {
    action: 'document.filename_updated',
    description: 'Nome do arquivo atualizado na confirmação.',
    documentId: input.documentId,
    versionId: input.versionId,
    target: {
      type: 'document',
      id: input.documentId,
      nameSnapshot: documentNameSnapshot,
    },
    metadata: sanitizeAuditMetadata({
      documentName: documentNameSnapshot,
      namingMode: input.namingMode,
      source: 'api',
    }),
    before: sanitizeAuditMetadata({ fileName: beforeName }),
    after: sanitizeAuditMetadata({ fileName: input.resolved.finalFileName }),
    changes: [
      {
        field: 'finalFileName',
        before: beforeName,
        after: input.resolved.finalFileName,
      },
    ],
    occurredAt: input.occurredAt,
  };
}
