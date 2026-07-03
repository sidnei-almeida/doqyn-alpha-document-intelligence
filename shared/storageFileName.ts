export type StorageNamingMode = 'ai_suggested' | 'original' | 'manual';

export type ResolveStorageFileNamesInput = {
  originalFileName: string;
  aiSuggestedFileName: string;
  namingMode?: StorageNamingMode;
  manualName?: string;
  finalFileName?: string;
  documentId?: string;
  versionLabel?: string;
};

export type ResolvedStorageFileNames = {
  namingMode: StorageNamingMode;
  originalFileName: string;
  aiSuggestedFileName: string;
  selectedFileName?: string;
  finalFileName: string;
  storageFileName: string;
  previewStorageFileName: string;
};

/** Nomes genéricos proibidos como storageFileName final. */
export const INVALID_GENERIC_STORAGE_NAMES = new Set([
  '.',
  '..',
  '.pdf',
  'documento.pdf',
  'original.pdf',
  'preview.pdf',
  'arquivo.pdf',
  'file.pdf',
  'upload.pdf',
  'document.pdf',
  'sem_nome.pdf',
]);

function removeAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function sanitizeFileNameSegment(value: string, fallback: string): string {
  const normalized = removeAccents(value)
    .replace(/[/\\;]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

  return normalized || fallback;
}

export function ensurePdfExtension(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '');
  return `${base}.pdf`;
}

export function limitFileNameLength(fileName: string, maxLength = 180): string {
  if (fileName.length <= maxLength) return fileName;
  const ext = '.pdf';
  const base = fileName.slice(0, maxLength - ext.length);
  return `${base}${ext}`;
}

export function stripEmailFromFileName(name: string): string {
  return name.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
}

/** Remove CPF/CNPJ (11 ou 14 dígitos) de segmentos de nome de arquivo. */
export function stripSensitiveIdentifiersFromFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '');
  const segments = base
    .split('_')
    .map((segment) =>
      segment
        .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '')
        .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '')
        .replace(/^\d{11}$/, '')
        .replace(/^\d{14}$/, '')
        .trim(),
    )
    .filter(Boolean);

  const joined = segments.join('_') || 'Documento';
  return ensurePdfExtension(`${joined}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf'));
}

export function buildStorageFileNameFallback(
  documentId?: string,
  versionLabel?: string,
): string {
  const versionToken = (versionLabel ?? 'v1').replace(/[^\d]/g, '') || '1';
  const docToken = documentId?.replace(/^doc_/, '').slice(0, 12) || 'documento';
  return `Documento_${docToken}_v${versionToken}.pdf`;
}

export function isInvalidGenericStorageFileName(fileName: string): boolean {
  return INVALID_GENERIC_STORAGE_NAMES.has(fileName.toLowerCase());
}

export function sanitizeStorageFileName(
  name: string,
  fallback: string,
  options?: { stripSensitive?: boolean },
): string {
  const working = stripEmailFromFileName(name);
  const withoutExt = working.replace(/\.pdf$/i, '').trim();

  if (!withoutExt || withoutExt === '.' || withoutExt === '..') {
    return fallback;
  }

  const base = sanitizeFileNameSegment(withoutExt, '');
  if (!base) {
    return fallback;
  }

  let result = limitFileNameLength(ensurePdfExtension(base));

  if (options?.stripSensitive !== false) {
    result = stripSensitiveIdentifiersFromFileName(result);
  }

  if (isInvalidGenericStorageFileName(result)) {
    return fallback;
  }

  return result;
}

export function buildPreviewStorageFileName(storageFileName: string): string {
  const base = storageFileName.replace(/\.pdf$/i, '');
  return limitFileNameLength(`${base}_preview.pdf`);
}

export function resolveStorageFileNames(
  input: ResolveStorageFileNamesInput,
): ResolvedStorageFileNames {
  const namingMode = input.namingMode ?? 'ai_suggested';
  const fallback = buildStorageFileNameFallback(input.documentId, input.versionLabel);

  const aiSuggestedFileName = input.aiSuggestedFileName?.trim()
    ? sanitizeStorageFileName(input.aiSuggestedFileName, fallback)
    : '';

  const originalSanitized = sanitizeStorageFileName(input.originalFileName, fallback);

  let selectedFileName: string | undefined;
  let finalFileName: string;

  const explicitFinal = input.finalFileName?.trim();

  switch (namingMode) {
    case 'original':
      finalFileName = explicitFinal
        ? sanitizeStorageFileName(explicitFinal, fallback)
        : originalSanitized;
      break;
    case 'manual': {
      const manual = input.manualName ?? input.finalFileName;
      if (!manual?.trim()) {
        throw new Error('Nome manual inválido.');
      }
      selectedFileName = sanitizeStorageFileName(manual, fallback);
      finalFileName = selectedFileName;
      break;
    }
    case 'ai_suggested':
    default:
      if (explicitFinal) {
        finalFileName = sanitizeStorageFileName(explicitFinal, fallback);
      } else if (aiSuggestedFileName) {
        finalFileName = aiSuggestedFileName;
      } else {
        finalFileName = fallback;
      }
      break;
  }

  const storageFileName = finalFileName;
  const previewStorageFileName = buildPreviewStorageFileName(storageFileName);

  return {
    namingMode,
    originalFileName: input.originalFileName,
    aiSuggestedFileName,
    selectedFileName,
    finalFileName,
    storageFileName,
    previewStorageFileName,
  };
}
