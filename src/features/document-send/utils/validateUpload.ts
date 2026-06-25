import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  UPLOAD_ERROR_MESSAGES,
} from '../uploadConstants';

export type FileValidationResult =
  | { valid: true; files: File[] }
  | { valid: false; error: string };

export function isAllowedPdfFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.pdf')) return false;
  if (!file.type || file.type === 'application/octet-stream') return true;
  return ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number]);
}

function isAllowedType(file: File): boolean {
  return isAllowedPdfFile(file);
}

export function validateUploadFiles(
  incoming: File[],
  existingCount = 0,
): FileValidationResult {
  const total = existingCount + incoming.length;

  if (total > MAX_FILES_PER_BATCH) {
    return { valid: false, error: UPLOAD_ERROR_MESSAGES.tooManyFiles };
  }

  for (const file of incoming) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: UPLOAD_ERROR_MESSAGES.fileTooLarge };
    }

    if (!isAllowedType(file)) {
      return { valid: false, error: UPLOAD_ERROR_MESSAGES.unsupportedFormat };
    }
  }

  return { valid: true, files: incoming };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
