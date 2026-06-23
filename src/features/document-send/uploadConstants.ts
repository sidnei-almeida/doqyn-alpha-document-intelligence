export const MAX_FILES_PER_BATCH = 25;
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
] as const;

export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];

export const UPLOAD_ERROR_MESSAGES = {
  tooManyFiles: 'Este lote possui arquivos demais. Envie no máximo 25 arquivos por vez.',
  fileTooLarge: 'Arquivo acima do limite permitido.',
  unsupportedFormat: 'Formato não suportado para análise automática.',
  requiresReview: 'Este documento será enviado para revisão manual.',
} as const;
