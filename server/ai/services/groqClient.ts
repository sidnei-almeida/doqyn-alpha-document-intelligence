import Groq from 'groq-sdk';
import { AI_ERROR_MESSAGES, DEFAULT_GROQ_MODEL } from '../constants.js';
import {
  diagnoseClassifierError,
  sanitizeDiagnosticText,
  shouldRetryWithoutResponseFormat,
} from '../utils/classifierDiagnostics.js';
import { AiAnalysisError } from '../utils/errors.js';
import { logger } from '../../utils/logger.js';

let groqClient: Groq | null = null;

export type GroqPromptContext = {
  requestId?: string;
  jobId?: string;
  companyId?: string;
  database?: string;
  operation?: string;
};

export type CompleteJsonPromptOptions = {
  context?: GroqPromptContext;
  model?: string;
};

function getGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.groqNotConfigured, 'GROQ_NOT_CONFIGURED', 503);
  }
  return apiKey;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function getGroqClassifierModel(): string {
  return process.env.GROQ_CLASSIFIER_MODEL?.trim() || getGroqModel();
}

export function getGroqExtractorModel(): string {
  return process.env.GROQ_EXTRACTOR_MODEL?.trim() || getGroqModel();
}

export function isGroqApiKeyConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: getGroqApiKey() });
  }
  return groqClient;
}

function isRateLimitError(error: unknown): boolean {
  const diagnostic = diagnoseClassifierError(error);
  return diagnostic.code === 'GROQ_RATE_LIMIT';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRetryAfterMs(error: unknown): number {
  const defaultMs = 2000;
  const maxMs = 10000;

  if (!error || typeof error !== 'object') return defaultMs;

  const headers = (error as { headers?: Headers | Record<string, string> }).headers;
  if (!headers) return defaultMs;

  let raw: string | null = null;
  if (headers instanceof Headers) {
    raw = headers.get('retry-after');
  } else if (typeof headers === 'object') {
    const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'retry-after');
    raw = entry?.[1] ?? null;
  }

  if (!raw) return defaultMs;

  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return defaultMs;

  return Math.min(seconds * 1000, maxMs);
}

async function callGroqCompletion(
  prompt: string,
  useResponseFormat: boolean,
  model: string,
): Promise<{ content: string; durationMs: number }> {
  const client = getGroqClient();
  const startedAt = Date.now();

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    ...(useResponseFormat ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [
      {
        role: 'system',
        content: useResponseFormat
          ? 'Você é um assistente documental do DOQYN. Responda apenas com JSON válido.'
          : 'Você é um assistente documental do DOQYN. Responda apenas com um objeto JSON válido, sem markdown e sem texto fora do JSON.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.analysisFailed, 'GROQ_EMPTY_RESPONSE', 502);
  }

  return { content: content.trim(), durationMs: Date.now() - startedAt };
}

export async function completeJsonPrompt(
  prompt: string,
  options?: CompleteJsonPromptOptions,
): Promise<string> {
  const context = options?.context;
  const operation = context?.operation ?? 'json_prompt';
  const model =
    operation === 'document_classification'
      ? getGroqClassifierModel()
      : operation === 'metadata_extraction'
        ? getGroqExtractorModel()
        : options?.model ?? getGroqModel();
  const responseFormat = 'json_object';
  const promptChars = prompt.length;

  logger.info('groq completion request started', {
    requestId: context?.requestId,
    jobId: context?.jobId,
    companyId: context?.companyId,
    database: context?.database,
    operation,
    model,
    classifierModel: getGroqClassifierModel(),
    extractorModel: getGroqExtractorModel(),
    responseFormat,
    promptChars,
    groqApiKeyConfigured: isGroqApiKeyConfigured(),
  });

  try {
    const first = await callGroqCompletion(prompt, true, model);

    logger.info('groq completion request completed', {
      requestId: context?.requestId,
      jobId: context?.jobId,
      companyId: context?.companyId,
      operation,
      model,
      responseFormat,
      groqCalled: true,
      groqDurationMs: first.durationMs,
      responseChars: first.content.length,
      retriedWithoutResponseFormat: false,
      retriedAfterRateLimit: false,
    });

    return first.content;
  } catch (firstError) {
    const firstDiag = diagnoseClassifierError(firstError);

    if (isRateLimitError(firstError)) {
      const retryAfterMs = readRetryAfterMs(firstError);

      logger.warn('Retrying Groq after rate limit (429).', {
        requestId: context?.requestId,
        jobId: context?.jobId,
        companyId: context?.companyId,
        operation,
        model,
        httpStatus: firstDiag.httpStatus,
        retryAfterMs,
      });

      await sleep(retryAfterMs);

      try {
        const rateRetry = await callGroqCompletion(prompt, true, model);

        logger.info('groq completion rate-limit retry completed', {
          requestId: context?.requestId,
          jobId: context?.jobId,
          companyId: context?.companyId,
          operation,
          model,
          responseFormat,
          groqCalled: true,
          groqDurationMs: rateRetry.durationMs,
          responseChars: rateRetry.content.length,
          retriedAfterRateLimit: true,
        });

        return rateRetry.content;
      } catch (rateRetryError) {
        const rateRetryDiag = diagnoseClassifierError(rateRetryError);
        logger.error('groq completion rate-limit retry failed', {
          requestId: context?.requestId,
          jobId: context?.jobId,
          companyId: context?.companyId,
          operation,
          model,
          errorCode: rateRetryDiag.code,
          errorMessage: rateRetryDiag.internalMessage,
          httpStatus: rateRetryDiag.httpStatus,
          retriedAfterRateLimit: true,
        });
        throw new AiAnalysisError(
          AI_ERROR_MESSAGES.aiUnavailable,
          'GROQ_RATE_LIMIT',
          503,
        );
      }
    }

    logger.warn('groq completion failed', {
      requestId: context?.requestId,
      jobId: context?.jobId,
      companyId: context?.companyId,
      operation,
      model,
      responseFormat,
      groqCalled: true,
      errorName: firstDiag.errorName,
      errorCode: firstDiag.code,
      errorMessage: firstDiag.internalMessage,
      httpStatus: firstDiag.httpStatus,
      groqErrorCode: firstDiag.groqErrorCode,
      parseFailed: false,
      validationFailed: false,
    });

    if (!shouldRetryWithoutResponseFormat(firstError)) {
      throw firstError;
    }

    logger.warn('Retrying without response_format due to model compatibility error.', {
      requestId: context?.requestId,
      jobId: context?.jobId,
      companyId: context?.companyId,
      operation,
      model,
      previousErrorCode: firstDiag.code,
    });

    try {
      const retry = await callGroqCompletion(prompt, false, model);

      logger.info('groq completion retry completed', {
        requestId: context?.requestId,
        jobId: context?.jobId,
        companyId: context?.companyId,
        operation,
        model,
        responseFormat: 'none',
        groqCalled: true,
        groqDurationMs: retry.durationMs,
        responseChars: retry.content.length,
        retriedWithoutResponseFormat: true,
      });

      return retry.content;
    } catch (retryError) {
      const retryDiag = diagnoseClassifierError(retryError);

      logger.error('groq completion retry failed', {
        requestId: context?.requestId,
        jobId: context?.jobId,
        companyId: context?.companyId,
        operation,
        model,
        responseFormat: 'none',
        groqCalled: true,
        errorName: retryDiag.errorName,
        errorCode: retryDiag.code,
        errorMessage: retryDiag.internalMessage,
        httpStatus: retryDiag.httpStatus,
        groqErrorCode: retryDiag.groqErrorCode,
        retriedWithoutResponseFormat: true,
        parseFailed: false,
        validationFailed: false,
        retryErrorMessage: sanitizeDiagnosticText(
          retryError instanceof Error ? retryError.message : String(retryError),
        ),
      });

      throw retryError;
    }
  }
}
