import {
  resolveStorageFileNames,
  type StorageNamingMode,
} from '../../../../shared/storageFileName.ts';

export type DocumentNamingMode = StorageNamingMode;

export function previewFinalFileName(input: {
  originalFileName: string;
  aiSuggestedFileName: string;
  namingMode: DocumentNamingMode;
  manualName?: string;
  documentId?: string;
  versionLabel?: string;
}): string {
  if (input.namingMode === 'manual' && !input.manualName?.trim()) {
    return '—';
  }

  try {
    const resolved = resolveStorageFileNames({
      originalFileName: input.originalFileName,
      aiSuggestedFileName: input.aiSuggestedFileName,
      namingMode: input.namingMode,
      manualName: input.manualName,
      finalFileName: input.namingMode === 'manual' ? input.manualName : undefined,
      documentId: input.documentId ?? 'preview_doc',
      versionLabel: input.versionLabel ?? 'v1',
    });
    return resolved.finalFileName;
  } catch {
    return '—';
  }
}
