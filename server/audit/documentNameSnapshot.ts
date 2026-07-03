const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const CNPJ_PATTERN = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const DOCUMENT_NAME_FALLBACK = 'Documento em análise';

export function redactDocumentName(value: string): string {
  return value
    .replace(CPF_PATTERN, '[CPF]')
    .replace(CNPJ_PATTERN, '[CNPJ]')
    .replace(EMAIL_PATTERN, '[email]');
}

export function sanitizeDocumentNameSnapshot(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  return redactDocumentName(value.trim());
}

export function pickFirstDocumentName(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const safe = sanitizeDocumentNameSnapshot(candidate);
    if (safe) return safe;
  }
  return undefined;
}

export function friendlyPreviewStorageName(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  const withoutPreviewSuffix = value.trim().replace(/_preview(?=\.[^.]+$)/i, '');
  return sanitizeDocumentNameSnapshot(withoutPreviewSuffix);
}

export function buildAnalysisJobNameSnapshot(input: {
  originalFileName?: string | null;
  recommendedFileName?: string | null;
  aiSuggestedFileName?: string | null;
  uploadFileName?: string | null;
}): string {
  return (
    pickFirstDocumentName(
      input.recommendedFileName,
      input.aiSuggestedFileName,
      input.originalFileName,
      input.uploadFileName,
    ) ?? DOCUMENT_NAME_FALLBACK
  );
}

export function buildDocumentNameSnapshot(input: {
  finalFileName?: string | null;
  storageFileName?: string | null;
  currentFileName?: string | null;
  previewStorageFileName?: string | null;
  aiSuggestedFileName?: string | null;
  recommendedFileName?: string | null;
  originalFileName?: string | null;
}): string {
  return (
    pickFirstDocumentName(
      input.finalFileName,
      input.storageFileName,
      input.currentFileName,
      friendlyPreviewStorageName(input.previewStorageFileName),
      input.aiSuggestedFileName,
      input.recommendedFileName,
      input.originalFileName,
    ) ?? DOCUMENT_NAME_FALLBACK
  );
}

export function resolveTrackingDocumentName(input: {
  metadata: Record<string, unknown>;
  documentId: string | null;
  documentNames: Map<string, string>;
}): string {
  const target = input.metadata.target;
  const targetRecord =
    target && typeof target === 'object' && !Array.isArray(target)
      ? (target as Record<string, unknown>)
      : null;

  const fromLog = pickFirstDocumentName(
    typeof targetRecord?.nameSnapshot === 'string' ? targetRecord.nameSnapshot : undefined,
    typeof input.metadata.documentName === 'string' ? input.metadata.documentName : undefined,
    typeof input.metadata.storageFileName === 'string' ? input.metadata.storageFileName : undefined,
    friendlyPreviewStorageName(
      typeof input.metadata.previewStorageFileName === 'string'
        ? input.metadata.previewStorageFileName
        : undefined,
    ),
    typeof input.metadata.aiSuggestedFileName === 'string'
      ? input.metadata.aiSuggestedFileName
      : undefined,
  );

  if (fromLog) return fromLog;

  if (input.documentId) {
    const currentName = input.documentNames.get(input.documentId);
    if (currentName) return redactDocumentName(currentName);
  }

  return DOCUMENT_NAME_FALLBACK;
}
