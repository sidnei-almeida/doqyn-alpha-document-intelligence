import { createHash } from 'node:crypto';
/**
 * TEMPORÁRIO — logs extremamente verbosos do pipeline de IA/OCR.
 * Prefixo fixo `AI_PIPELINE_DEBUG` para grepar e remover depois.
 *
 * Desligar: AI_PIPELINE_DEBUG=false
 * Ligar (default enquanto depuramos): AI_PIPELINE_DEBUG=true ou omitido
 */
import { logger } from '../../utils/logger.js';

export const AI_PIPELINE_DEBUG_TAG = 'AI_PIPELINE_DEBUG';

const DEFAULT_PREVIEW_CHARS = 240;

export function isPipelineDebugEnabled(): boolean {
  const raw = process.env.AI_PIPELINE_DEBUG?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  // Default OFF — ligar só com AI_PIPELINE_DEBUG=true
  return false;
}

export function previewText(value: unknown, maxChars = DEFAULT_PREVIEW_CHARS): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…[+${text.length - maxChars} chars]`;
}

export function summarizeError(error: unknown): Record<string, unknown> {
  if (error == null) return { errorPresent: false };

  if (typeof error !== 'object') {
    return { errorPresent: true, errorType: typeof error, errorMessage: String(error) };
  }

  const err = error as Record<string, unknown> & {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
    status?: number;
    statusCode?: number;
    cause?: unknown;
  };

  const summary: Record<string, unknown> = {
    errorPresent: true,
    errorName: err.name,
    errorMessage: previewText(err.message, 800),
    errorCode: err.code,
    errorStatus: err.status ?? err.statusCode,
    errorStack:
      typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 12).join('\n') : undefined,
  };

  if (err.cause != null) {
    summary.errorCause = summarizeError(err.cause);
  }

  for (const key of [
    'statusText',
    'errorDetails',
    'details',
    'type',
    'param',
    'errno',
    'syscall',
    'path',
  ]) {
    if (key in err && err[key] != null) {
      summary[`error_${key}`] =
        typeof err[key] === 'string' ? previewText(err[key], 400) : err[key];
    }
  }

  return summary;
}

export function pipelineDebug(
  stage: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!isPipelineDebugEnabled()) return;
  logger.debug(`[${AI_PIPELINE_DEBUG_TAG}] [${stage}] ${message}`, {
    debugTag: AI_PIPELINE_DEBUG_TAG,
    stage,
    ...meta,
  });
}

export function pipelineInfo(
  stage: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!isPipelineDebugEnabled()) return;
  logger.info(`[${AI_PIPELINE_DEBUG_TAG}] [${stage}] ${message}`, {
    debugTag: AI_PIPELINE_DEBUG_TAG,
    stage,
    ...meta,
  });
}

export function pipelineWarn(
  stage: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  logger.warn(`[${AI_PIPELINE_DEBUG_TAG}] [${stage}] ${message}`, {
    debugTag: AI_PIPELINE_DEBUG_TAG,
    stage,
    ...meta,
  });
}

export function pipelineError(
  stage: string,
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
): void {
  logger.error(`[${AI_PIPELINE_DEBUG_TAG}] [${stage}] ${message}`, {
    debugTag: AI_PIPELINE_DEBUG_TAG,
    stage,
    ...meta,
    ...summarizeError(error),
  });
}

export function bufferMeta(
  buffer: Buffer | undefined | null,
  label = 'buffer',
): Record<string, unknown> {
  if (!buffer) {
    return { [`${label}Present`]: false, [`${label}Bytes`]: 0 };
  }
  return {
    [`${label}Present`]: true,
    [`${label}Bytes`]: buffer.length,
    [`${label}Sha256Prefix`]: createHash('sha256').update(buffer).digest('hex').slice(0, 12),
  };
}
