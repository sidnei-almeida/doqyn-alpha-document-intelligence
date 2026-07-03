import {
  buildPreviewStorageFileName,
  buildStorageFileNameFallback,
  INVALID_GENERIC_STORAGE_NAMES,
  resolveStorageFileNames as resolveStorageFileNamesCore,
  type ResolveStorageFileNamesInput,
  type ResolvedStorageFileNames,
  type StorageNamingMode,
} from '../../shared/storageFileName.js';
import { ServiceError } from './serviceErrors.js';

export type NamingMode = StorageNamingMode;

export type { ResolveStorageFileNamesInput, ResolvedStorageFileNames };

export {
  buildPreviewStorageFileName,
  buildStorageFileNameFallback,
  INVALID_GENERIC_STORAGE_NAMES,
};

export function resolveStorageFileNames(
  input: ResolveStorageFileNamesInput,
): ResolvedStorageFileNames {
  try {
    return resolveStorageFileNamesCore(input);
  } catch (error) {
    if (error instanceof Error && error.message === 'Nome manual inválido.') {
      throw new ServiceError(error.message, 'INVALID_FILE_NAME', 400);
    }
    throw error;
  }
}
