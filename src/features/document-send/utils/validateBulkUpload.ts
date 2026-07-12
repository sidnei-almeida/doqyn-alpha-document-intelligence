import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  UPLOAD_ERROR_MESSAGES,
} from '../uploadConstants';
import { isAllowedAnalysisFile } from './validateUpload';

export type BulkFileValidationResult = {
  validFiles: File[];
  invalidItems: Array<{ file: File; error: string }>;
  batchError?: string;
};

export function validateBulkFiles(files: File[]): BulkFileValidationResult {
  if (files.length > MAX_FILES_PER_BATCH) {
    return {
      validFiles: [],
      invalidItems: [],
      batchError: UPLOAD_ERROR_MESSAGES.tooManyFiles,
    };
  }

  const validFiles: File[] = [];
  const invalidItems: Array<{ file: File; error: string }> = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      invalidItems.push({ file, error: UPLOAD_ERROR_MESSAGES.fileTooLarge });
      continue;
    }

    if (!isAllowedAnalysisFile(file)) {
      invalidItems.push({ file, error: UPLOAD_ERROR_MESSAGES.unsupportedFormat });
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, invalidItems };
}
