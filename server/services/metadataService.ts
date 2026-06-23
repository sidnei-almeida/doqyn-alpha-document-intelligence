import { logger } from '../utils/logger.js';

export async function extractMetadata(input: {
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
}) {
  logger.debug('metadataExtractionService — modo simulado');

  // Future: Google Document AI / Cloud Vision API integration point
  return {
    fileName: input.originalFileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    documentType: input.documentType,
    extractedAt: new Date().toISOString(),
    fields: {
      detectedLanguage: 'pt-BR',
      pageCount: input.mimeType === 'application/pdf' ? 3 : 1,
    },
  };
}
