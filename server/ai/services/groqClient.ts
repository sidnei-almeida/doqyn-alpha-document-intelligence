import Groq from 'groq-sdk';
import { AI_ERROR_MESSAGES } from '../constants.js';
import { getGroqMaxOutputTokens, getGroqRequestTimeoutMs } from '../utils/aiConfig.js';
import {
  getInferenceConfig,
  getInferenceProviderName,
  isInferenceConfigured,
  resolveInferenceModel,
} from '../providers/inferenceProvider.js';
import {
  diagnoseClassifierError,
  sanitizeDiagnosticText,
  shouldRetryWithoutResponseFormat,
} from '../utils/classifierDiagnostics.js';
import { AiAnalysisError } from '../utils/errors.js';
import {
  acquireGroqSlot,
  estimateGroqTokens,
  GroqRateLimitWaitTimeout,
  reconcileGroqUsage,
} from './groqRateLimiter.js';
import { parseGroqLimitHeaders, rememberGroqLimits } from './groqLimitCalibration.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
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

/**
 * Cliente por fornecedor, não um só.
 *
 * O singleton único guardava o primeiro cliente construído. Trocar `INFERENCE_PROVIDER` — em teste,
 * ou num processo que atenda mais de um caminho — continuaria falando com o endereço antigo, e o
 * sintoma seria uma chave rejeitada num endpoint que ninguém escolheu. Chavear pelo destino custa
 * um Map e elimina a classe inteira de erro.
 */
const clientsByTarget = new Map<string, Groq>();

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

/**
 * Gasto de uma chamada, na moeda que importa aqui.
 *
 * O teto de refino é medido em token, não em requisição nem em segundo: a conta Groq limita por
 * tokens/minuto, e é essa janela que um laço de re-extração pode consumir inteira sozinho. Sem
 * devolver o gasto a quem chamou, `completion.usage` só vivia no log — informação boa demais para
 * ficar onde nenhum código consegue ler.
 */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export const EMPTY_TOKEN_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/**
 * A Groq não reporta uso quando a requisição falha, então erro conta como zero. Isso subestima o
 * gasto real de um documento que tomou 429 no meio — mas subestimar o consumido é o lado seguro:
 * o limitador de vazão (`groqRateLimiter`) já cobra a estimativa antes da chamada, e é ele que
 * protege a janela por minuto. O orçamento aqui protege outra coisa: quantas vezes o laço pode
 * insistir no mesmo documento.
 */
function toTokenUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | undefined,
): TokenUsage {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
  };
}

type GroqCompletionAnswer = {
  content: string;
  durationMs: number;
  finishReason?: string | null;
  usage: TokenUsage;
};

export type JsonPromptResult = {
  content: string;
  /** Soma de todas as tentativas — repetição de JSON e retentativa de rate limit incluídas. */
  usage: TokenUsage;
  model: string;
  durationMs: number;
  /**
   * A resposta bateu no teto de saída e foi cortada.
   *
   * O pior caso do pipeline é este e ele era silencioso: JSON válido **e** truncado ao mesmo tempo.
   * O objeto fecha, o parse passa, a extração segue, e os campos que ficaram do outro lado do corte
   * somem sem ninguém reclamar. Foi assim que um teto de saída baixo passou por "o modelo não achou
   * a data de assinatura". Devolver o sinal é o que permite tratar isso como resultado incompleto
   * em vez de resultado.
   */
  truncated: boolean;
};

function requireInferenceApiKey(): { apiKey: string; baseURL: string | null } {
  const config = getInferenceConfig();
  if (!config.apiKey) {
    logger.warn('provedor de inferência sem chave configurada', {
      provider: config.provider,
      expectedEnv: config.apiKeyEnvName,
    });
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.aiProviderNotConfigured,
      'AI_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }
  return { apiKey: config.apiKey, baseURL: config.baseURL };
}

export function getGroqModel(): string {
  return resolveInferenceModel('default');
}

export function getGroqClassifierModel(): string {
  return resolveInferenceModel('classifier');
}

export function getGroqExtractorModel(): string {
  return resolveInferenceModel('extractor');
}

/**
 * O juiz pode rodar num modelo diferente do extrator.
 *
 * Julgar é escolher entre quatro vereditos; extrair é produzir a resposta certa entre milhares.
 * Espaço de saída menor perdoa modelo menor, e é essa a hipótese que a bancada do conjunto difícil
 * mede. Enquanto ela não decidir, o default é o mesmo modelo de sempre: barganhar qualidade antes
 * de medir seria trocar acerto por economia no escuro.
 */
export function getGroqEvaluatorModel(): string {
  return resolveInferenceModel('evaluator');
}

export function isGroqApiKeyConfigured(): boolean {
  return isInferenceConfigured();
}

/**
 * O `groq-sdk` escreve o caminho da Groq por extenso — `/openai/v1/chat/completions` — e só deixa
 * trocar o host. Com a base do Fireworks a chamada virava `/inference/v1/openai/v1/chat/completions`
 * e voltava 404 em toda requisição: o caminho alternativo nasceu inerte e quebrado ao mesmo tempo, e
 * só o pipeline de verdade mostrou, porque o teste com curl não passava pelo SDK. O prefixo
 * `/openai/v1` é da Groq, não do formato OpenAI; fora dela ele sai antes de a requisição partir.
 */
export function stripGroqPathPrefix(url: string, baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '');
  const groqPrefix = `${base}/openai/v1/`;
  return url.startsWith(groqPrefix) ? `${base}/${url.slice(groqPrefix.length)}` : url;
}

function fetchWithoutGroqPrefix(baseURL: string): typeof fetch {
  return (input, init) => {
    if (typeof input === 'string') return fetch(stripGroqPathPrefix(input, baseURL), init);
    if (input instanceof URL) return fetch(stripGroqPathPrefix(input.href, baseURL), init);
    return fetch(input, init);
  };
}

function getGroqClient(): Groq {
  const { apiKey, baseURL } = requireInferenceApiKey();
  const target = baseURL ?? 'groq-default';

  const existing = clientsByTarget.get(target);
  if (existing) return existing;

  // `baseURL` ausente deixa o SDK usar o endereço da Groq — o caminho antigo, byte a byte.
  const client = new Groq(
    baseURL ? { apiKey, baseURL, fetch: fetchWithoutGroqPrefix(baseURL) } : { apiKey },
  );
  clientsByTarget.set(target, client);
  return client;
}

/** Descarta os clientes em cache. Só para teste: em produção o alvo não muda em tempo de execução. */
export function resetInferenceClientsForTests(): void {
  clientsByTarget.clear();
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
        new AiAnalysisError(AI_ERROR_MESSAGES.groqRequestTimeout, 'GROQ_REQUEST_TIMEOUT', 504),
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

/**
 * Modelo que raciocina antes de responder.
 *
 * Nesses, `max_tokens` cobre o pensamento **e** a resposta, e o pensamento vem primeiro. Sem
 * baixar o esforço, a extração de um documento inteiro gasta o orçamento raciocinando e devolve
 * JSON cortado. O pipeline quer campos preenchidos, não deliberação: `low` é o que serve.
 */
function modelForOperation(operation: string): string {
  switch (operation) {
    case 'document_classification':
    // A proposta de categoria é trabalho de classificação: ler o documento e dizer em que
    // prateleira ele mora. Segue o mesmo modelo, não o genérico.
    case 'category_suggestion':
      return getGroqClassifierModel();
    case 'metadata_extraction':
    case 'focused_extraction':
      return getGroqExtractorModel();
    case 'extraction_evaluation':
      return getGroqEvaluatorModel();
    default:
      return getGroqModel();
  }
}

function usesReasoningEffort(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes('gpt-oss') || normalized.includes('qwen3');
}

async function callGroqCompletion(
  prompt: string,
  useResponseFormat: boolean,
  model: string,
  operation: string,
): Promise<GroqCompletionAnswer> {
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

    // Espera a vez na vazão da conta antes de gastar a requisição. Ficar na fila alguns segundos
    // é melhor que tomar 429 e derrubar o documento em "IA indisponível" — de onde ele só sai com
    // ação humana.
    const estimatedTokens = estimateGroqTokens(prompt.length);

    try {
      await acquireGroqSlot({
        operation,
        model,
        estimatedTokens,
      });
    } catch (waitError) {
      if (waitError instanceof GroqRateLimitWaitTimeout) {
        // Vira o mesmo erro do 429 da própria Groq de propósito: a saturação é a mesma, e todo o
        // caminho de cima já sabe tratar — documento em `ai_paused`, não em falha genérica.
        throw new AiAnalysisError(AI_ERROR_MESSAGES.aiUnavailable, 'GROQ_RATE_LIMIT', 429);
      }
      throw waitError;
    }

    // `withResponse` em vez de só o corpo: os limites reais da conta vêm nos cabeçalhos, e é deles
    // que o limitador se calibra em vez de viver do chute conservador do `.env`.
    const { data: completion, response } = await withGroqRequestTimeout(
      client.chat.completions
        .create({
          model,
          temperature: 0.1,
          max_tokens: getGroqMaxOutputTokens(),
          ...(usesReasoningEffort(model) ? { reasoning_effort: 'low' as const } : {}),
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
        })
        .withResponse(),
      timeoutMs,
    );

    const observedLimits = parseGroqLimitHeaders(response?.headers);
    if (observedLimits) {
      await rememberGroqLimits(model, observedLimits).catch(() => undefined);
    }

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

    // A janela do limitador foi debitada por estimativa; aqui ela passa a refletir o gasto que a
    // própria Groq reportou. Sem isso, sobra de reserva vira fila que não existe.
    if (usage?.total_tokens) {
      await reconcileGroqUsage({
        model,
        estimatedTokens,
        actualTokens: usage.total_tokens,
      }).catch(() => undefined);
    }

    const tokenUsage = toTokenUsage(usage);

    recordAiProviderRequest({
      provider: getInferenceProviderName(),
      operation,
      status: 'success',
      durationSeconds: durationMs / 1000,
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
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

    return { content: content.trim(), durationMs, finishReason, usage: tokenUsage };
  } catch (error) {
    recordAiProviderRequest({
      provider: getInferenceProviderName(),
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

/**
 * Uma segunda chance quando o JSON volta quebrado.
 *
 * Mesmo com `response_format: json_object` o texto às vezes chega inutilizável — quase sempre porque
 * a resposta bateu no teto de `max_tokens` e foi cortada no meio de uma chave. O usuário via
 * "a resposta da IA veio em formato inválido" e o documento caía na revisão manual por um problema
 * que uma repetição resolve.
 *
 * A repetição é única e leva o motivo junto: repetir mais que isso troca lentidão por lentidão, e é
 * exatamente a vazão que a conta gratuita não tem para dar.
 */
async function repairInvalidJsonAnswer(input: {
  answer: GroqCompletionAnswer;
  prompt: string;
  model: string;
  operation: string;
  context?: GroqPromptContext;
}): Promise<{
  content: string;
  retried: boolean;
  extraDurationMs?: number;
  usage: TokenUsage;
  truncated: boolean;
}> {
  if (safeParseJsonFromModel<unknown>(input.answer.content)) {
    /**
     * JSON válido e cortado ao mesmo tempo é o pior caso: o objeto fecha, a extração segue, e os
     * campos que ficaram do outro lado do corte somem sem ninguém reclamar. Foi assim que o teto de
     * saída baixo passou por "o modelo não achou a data de assinatura".
     */
    if (input.answer.finishReason === 'length') {
      logger.warn('groq respondeu JSON válido mas truncado; campos podem estar faltando', {
        requestId: input.context?.requestId,
        jobId: input.context?.jobId,
        operation: input.operation,
        model: input.model,
        responseChars: input.answer.content.length,
        maxOutputTokens: getGroqMaxOutputTokens(),
      });
    }

    return {
      content: input.answer.content,
      retried: false,
      usage: EMPTY_TOKEN_USAGE,
      truncated: input.answer.finishReason === 'length',
    };
  }

  const truncated = input.answer.finishReason === 'length';

  logger.warn('groq json inválido; repetindo uma vez', {
    requestId: input.context?.requestId,
    jobId: input.context?.jobId,
    operation: input.operation,
    model: input.model,
    finishReason: input.answer.finishReason,
    truncated,
    responseChars: input.answer.content.length,
    responsePreview: previewText(input.answer.content, 200),
  });

  const correction = truncated
    ? 'A resposta anterior foi cortada antes de fechar o JSON. Responda de novo, mais curta: mesmo formato, sem trechos longos em evidence/snippet.'
    : 'A resposta anterior não era um JSON válido. Responda de novo apenas com o objeto JSON pedido, sem markdown e sem texto fora dele.';

  try {
    const retry = await callGroqCompletion(
      `${input.prompt}\n\n${correction}`,
      true,
      input.model,
      input.operation,
    );

    return {
      content: retry.content,
      retried: true,
      extraDurationMs: retry.durationMs,
      usage: retry.usage,
      truncated: retry.finishReason === 'length',
    };
  } catch (error) {
    logger.warn('repeticao do JSON tambem falhou', {
      requestId: input.context?.requestId,
      jobId: input.context?.jobId,
      operation: input.operation,
      model: input.model,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    // Devolve a resposta original: quem chamou já sabe tratar conteúdo inválido.
    return {
      content: input.answer.content,
      retried: true,
      usage: EMPTY_TOKEN_USAGE,
      truncated: input.answer.finishReason === 'length',
    };
  }
}

/**
 * Só o texto. Mantida para os chamadores que não têm o que fazer com o gasto.
 */
export async function completeJsonPrompt(
  prompt: string,
  options?: CompleteJsonPromptOptions,
): Promise<string> {
  return (await completeJsonPromptWithUsage(prompt, options)).content;
}

export async function completeJsonPromptWithUsage(
  prompt: string,
  options?: CompleteJsonPromptOptions,
): Promise<JsonPromptResult> {
  const startedAt = Date.now();
  const context = options?.context;
  const operation = context?.operation ?? 'json_prompt';
  // O modelo explícito vence o mapa por operação: é assim que a bancada roda o mesmo Avaliador
  // duas vezes, num modelo cada, sem mexer em variável de ambiente entre as chamadas.
  const model = options?.model?.trim() || modelForOperation(operation);
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
    const repaired = await repairInvalidJsonAnswer({
      answer: first,
      prompt,
      model,
      operation,
      context,
    });

    logger.info('groq completion request completed', {
      requestId: context?.requestId,
      jobId: context?.jobId,
      companyId: context?.companyId,
      operation,
      model,
      responseFormat,
      groqCalled: true,
      groqDurationMs: first.durationMs + (repaired.extraDurationMs ?? 0),
      responseChars: repaired.content.length,
      finishReason: first.finishReason,
      jsonRepairRetried: repaired.retried,
      retriedWithoutResponseFormat: false,
      retriedAfterRateLimit: false,
    });

    return {
      content: repaired.content,
      usage: addTokenUsage(first.usage, repaired.usage),
      model,
      durationMs: Date.now() - startedAt,
      truncated: repaired.truncated,
    };
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

          return {
            content: rateRetry.content,
            usage: rateRetry.usage,
            model,
            durationMs: Date.now() - startedAt,
            truncated: rateRetry.finishReason === 'length',
          };
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

      return {
        content: retry.content,
        usage: retry.usage,
        model,
        durationMs: Date.now() - startedAt,
        truncated: retry.finishReason === 'length',
      };
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
