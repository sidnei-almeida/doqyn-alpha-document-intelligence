export const MAX_FILES_PER_BATCH = 20;
export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;

export const UPLOAD_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

/** Espelha server/ai/constants.ts — usado apenas para regras de UI do modo Auto */
export const MIN_CLASSIFICATION_CONFIDENCE = 0.7;

export const AUTO_DELAY_SECONDS_DEFAULT = 10;
export const AUTO_DELAY_SECONDS_MIN = 0;
export const AUTO_DELAY_SECONDS_MAX = 30;

export const AUTO_DELAY_STORAGE_KEY = 'doqyn.upload.autoDelaySeconds';
export const AUTO_MODE_STORAGE_KEY = 'doqyn.upload.autoMode';

export const BULK_NEXT_ITEM_DELAY_MS = 1200;

export const UPLOAD_ERROR_MESSAGES = {
  tooManyFiles: 'Selecione até 20 documentos por vez nesta versão.',
  fileTooLarge: 'O arquivo excede o limite de 15MB.',
  unsupportedFormat: 'Envie PDF ou imagem (JPG, PNG ou WebP) nesta etapa.',
  requiresReview: 'Este documento será enviado para revisão manual.',
} as const;

export function clampAutoDelaySeconds(value: number): number {
  return Math.min(AUTO_DELAY_SECONDS_MAX, Math.max(AUTO_DELAY_SECONDS_MIN, Math.round(value)));
}
