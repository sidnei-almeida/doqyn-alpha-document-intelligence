import {
  AI_ERROR_MESSAGES,
  MAX_FILE_SIZE_BYTES,
  extensionAllowedForAnalysis,
  isAllowedAnalysisMimeType,
  resolveAnalysisMimeType,
  type AllowedAnalysisMimeType,
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

export function validateAnalysisUpload(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): AllowedAnalysisMimeType {
  if (!input.buffer.length) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.emptyFile, 'EMPTY_FILE', 400);
  }

  if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.fileTooLarge, 'FILE_TOO_LARGE', 400);
  }

  if (!extensionAllowedForAnalysis(input.originalFileName)) {
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.unsupportedFormat,
      'INVALID_EXTENSION',
      400,
    );
  }

  const resolved = resolveAnalysisMimeType({
    fileName: input.originalFileName,
    mimeType: input.mimeType,
  });

  if (!resolved) {
    const mime = input.mimeType.toLowerCase();
    if (
      mime &&
      mime !== 'application/octet-stream' &&
      !isAllowedAnalysisMimeType(mime)
    ) {
      throw new AiAnalysisError(
        AI_ERROR_MESSAGES.unsupportedFormat,
        'INVALID_MIME',
        400,
      );
    }
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.unsupportedFormat,
      'INVALID_MIME',
      400,
    );
  }

  return resolved;
}

/** @deprecated use validateAnalysisUpload */
export function validatePdfUpload(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): void {
  validateAnalysisUpload(input);
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
