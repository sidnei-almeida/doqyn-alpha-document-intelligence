import {
  AI_ERROR_MESSAGES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../constants.js';
import type { ProcessingLogItem } from '../types/documentAi.types.js';
import { AiAnalysisError } from '../utils/errors.js';
import { logger } from '../../utils/logger.js';

export type AnalyzeRequestContext = {
  requestId?: string;
  batchId?: string;
  itemId?: string;
  fileName?: string;
};

export function createLog(
  title: string,
  description: string,
  status: ProcessingLogItem['status'],
): ProcessingLogItem {
  return { title, description, status };
}

export function validatePdfUpload(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): void {
  if (!input.buffer.length) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.emptyFile, 'EMPTY_FILE', 400);
  }

  if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.fileTooLarge, 'FILE_TOO_LARGE', 400);
  }

  const lowerName = input.originalFileName.toLowerCase();
  if (!lowerName.endsWith('.pdf')) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.pdfOnly, 'INVALID_EXTENSION', 400);
  }

  const mime = input.mimeType.toLowerCase();
  if (
    mime &&
    mime !== 'application/octet-stream' &&
    !ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])
  ) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.pdfOnly, 'INVALID_MIME', 400);
  }
}

export function logAnalyzeStage(
  message: string,
  context: AnalyzeRequestContext,
  details: Record<string, unknown>,
): void {
  logger.info(message, {
    requestId: context.requestId,
    batchId: context.batchId,
    itemId: context.itemId,
    fileName: context.fileName,
    ...details,
  });
}
