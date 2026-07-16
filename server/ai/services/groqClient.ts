import Groq from 'groq-sdk';
import { AI_ERROR_MESSAGES } from '../constants.js';
import {
  getGroqMaxOutputTokens,
  getGroqModelFromEnv,
  getGroqRequestTimeoutMs,
} from '../utils/aiConfig.js';
import {
  diagnoseClassifierError,
  sanitizeDiagnosticText,
  shouldRetryWithoutResponseFormat,
} from '../utils/classifierDiagnostics.js';
import { AiAnalysisError } from '../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { recordAiProviderRequest } from '../../metrics/prometheus.js';
import {
  pipelineDebug,
  pipelineError,
  pipelineInfo,
  pipelineWarn,
  previewText,
  summarizeError,
} from '../utils/pipelineDebug.js';

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
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.aiProviderNotConfigured,
      'AI_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }
  return apiKey;
}

export function getGroqModel(): string {
  return getGroqModelFromEnv();
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
  return (
    diagnostic.code === 'GROQ_RATE_LIMIT' ||
    diagnostic.code === 'GROQ_DAILY_TOKEN_LIMIT' ||
    diagnostic.code === 'GROQ_CONTEXT_LIMIT'
  );
}

function rateLimitErrorCode(diagnostic: ReturnType<typeof diagnoseClassifierError>): string {
  if (diagnostic.code === 'GROQ_DAILY_TOKEN_LIMIT') return 'GROQ_DAILY_TOKEN_LIMIT';
  if (diagnostic.code === 'GROQ_CONTEXT_LIMIT') return 'GROQ_CONTEXT_LIMIT';
  return 'GROQ_RATE_LIMIT';
}

function rateLimitErrorMessage(diagnostic: ReturnType<typeof diagnoseClassifierError>): string {
  if (diagnostic.code === 'GROQ_DAILY_TOKEN_LIMIT') {
    return AI_ERROR_MESSAGES.groqDailyTokenLimit;
  }
  if (diagnostic.code === 'GROQ_CONTEXT_LIMIT') {
    return AI_ERROR_MESSAGES.groqContextLimit;
  }
  return AI_ERROR_MESSAGES.aiUnavailable;
}

const RATE_LIMIT_RETRY_DELAYS_MS = [2000, 5000, 10000] as const;

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

function withGroqRequestTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AiAnalysisError(
          AI_ERROR_MESSAGES.groqRequestTimeout,
          'GROQ_REQUEST_TIMEOUT',
          504,
        ),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function callGroqCompletion(
  prompt: string,
  useResponseFormat: boolean,
  model: string,
  operation: string,
): Promise<{ content: string; durationMs: number }> {
  const startedAt = Date.now();

  pipelineDebug('groq.call', 'enviando chat.completions.create', {
    model,
    operation,
    useResponseFormat,
    promptChars: prompt.length,
    promptPreview: previewText(prompt, 280),
    maxOutputTokens: getGroqMaxOutputTokens(),
    timeoutMs: getGroqRequestTimeoutMs(),
  });

  try {
    const client = getGroqClient();
    const timeoutMs = getGroqRequestTimeoutMs();

    const completion = await withGroqRequestTimeout(
      client.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: getGroqMaxOutputTokens(),
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
      }),
      timeoutMs,
    );

    const content = completion.choices[0]?.message?.content;
    const finishReason = completion.choices[0]?.finish_reason;
    const usage = completion.usage;

    if (!content?.trim()) {
      pipelineError('groq.call', 'resposta vazia do Groq', undefined, {
        model,
        operation,
        finishReason,
        usage,
        durationMs: Date.now() - startedAt,
      });
      throw new AiAnalysisError(AI_ERROR_MESSAGES.analysisFailed, 'GROQ_EMPTY_RESPONSE', 502);
    }

    const durationMs = Date.now() - startedAt;
    recordAiProviderRequest({
      provider: 'groq',
      operation,
      status: 'success',
      durationSeconds: durationMs / 1000,
    });

    pipelineInfo('groq.call', 'chat.completions ok', {
      model,
      operation,
      durationMs,
      responseChars: content.length,
      finishReason,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      responsePreview: previewText(content, 280),
    });

    return { content: content.trim(), durationMs };
  } catch (error) {
    recordAiProviderRequest({
      provider: 'groq',
      operation,
      status: isRateLimitError(error) ? 'rate_limit' : 'error',
      durationSeconds: (Date.now() - startedAt) / 1000,
    });
    pipelineError('groq.call', 'chat.completions falhou', error, {
      model,
      operation,
      useResponseFormat,
      durationMs: Date.now() - startedAt,
      promptChars: prompt.length,
    });
    throw error;
  }
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
    maxOutputTokens: getGroqMaxOutputTokens(),
    groqApiKeyConfigured: isGroqApiKeyConfigured(),
  });

  pipelineInfo('groq.completeJson', 'início completeJsonPrompt', {
    requestId: context?.requestId,
    jobId: context?.jobId,
    companyId: context?.companyId,
    operation,
    model,
    promptChars,
    promptPreview: previewText(prompt, 200),
  });

  try {
    const first = await callGroqCompletion(prompt, true, model, operation);

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
      let lastError: unknown = firstError;

      for (let attempt = 0; attempt < RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
        const retryAfterMs = Math.max(
          readRetryAfterMs(lastError),
          RATE_LIMIT_RETRY_DELAYS_MS[attempt],
        );

        logger.warn('Retrying Groq after rate/context limit.', {
          requestId: context?.requestId,
          jobId: context?.jobId,
          companyId: context?.companyId,
          operation,
          model,
          attempt: attempt + 1,
          retryAfterMs,
          errorCode: diagnoseClassifierError(lastError).code,
        });

        await sleep(retryAfterMs);

        try {
          const rateRetry = await callGroqCompletion(prompt, true, model, operation);

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
            attempt: attempt + 1,
          });

          return rateRetry.content;
        } catch (retryError) {
          lastError = retryError;
        }
      }

      const finalDiag = diagnoseClassifierError(lastError);
      logger.error('groq completion rate-limit retries exhausted', {
        requestId: context?.requestId,
        jobId: context?.jobId,
        companyId: context?.companyId,
        operation,
        model,
        errorCode: finalDiag.code,
        errorMessage: finalDiag.internalMessage,
        httpStatus: finalDiag.httpStatus,
        retriedAfterRateLimit: true,
      });
      throw new AiAnalysisError(
        rateLimitErrorMessage(finalDiag),
        rateLimitErrorCode(finalDiag),
        503,
      );
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

    pipelineWarn('groq.completeJson', 'primeira tentativa falhou', {
      requestId: context?.requestId,
      jobId: context?.jobId,
      operation,
      model,
      ...summarizeError(firstError),
      diagnosticCode: firstDiag.code,
      willRetryWithoutResponseFormat: shouldRetryWithoutResponseFormat(firstError),
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
      const retry = await callGroqCompletion(prompt, false, model, operation);

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

export type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Completion de conversa (texto livre) para o chat documental. */
export async function completeChatConversation(
  messages: GroqChatMessage[],
  options?: { model?: string; context?: GroqPromptContext },
): Promise<string> {
  const model = options?.model ?? getGroqModel();
  const context = options?.context;
  const startedAt = Date.now();

  logger.info('groq chat completion started', {
    requestId: context?.requestId,
    operation: context?.operation ?? 'document_chat',
    model,
    messageCount: messages.length,
  });

  const client = getGroqClient();
  const completion = await withGroqRequestTimeout(
    client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: getGroqMaxOutputTokens(),
      messages,
    }),
    getGroqRequestTimeoutMs(),
  );

  const content = completion.choices[0]?.message?.content ?? '';

  logger.info('groq chat completion completed', {
    requestId: context?.requestId,
    model,
    durationMs: Date.now() - startedAt,
    outputChars: content.length,
  });

  return content;
}
