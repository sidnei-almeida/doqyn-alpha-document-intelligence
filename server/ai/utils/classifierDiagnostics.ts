import { AiAnalysisError } from './errors.js';

export type ClassifierFailureCode =
  | 'GROQ_API_KEY_MISSING'
  | 'GROQ_MODEL_ERROR'
  | 'GROQ_RATE_LIMIT'
  | 'GROQ_TIMEOUT'
  | 'GROQ_EMPTY_RESPONSE'
  | 'CLASSIFIER_INVALID_JSON'
  | 'CLASSIFIER_CLASS_NOT_ALLOWED'
  | 'CLASSIFIER_UNKNOWN_ERROR';

export type ClassifierDiagnostic = {
  code: ClassifierFailureCode;
  internalMessage: string;
  errorName?: string;
  httpStatus?: number;
  groqErrorCode?: string;
};

const SENSITIVE_PATTERNS = [
  /gsk_[a-zA-Z0-9]+/g,
  /sk-[a-zA-Z0-9]+/g,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
];

export function sanitizeDiagnosticText(value: string, maxLength = 500): string {
  let text = value.replace(/\s+/g, ' ').trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, '[redacted]');
  }
  return text.slice(0, maxLength);
}

function readErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isResponseFormatError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('response_format') ||
    lower.includes('json_object') ||
    lower.includes('json schema') ||
    lower.includes('structured outputs') ||
    (lower.includes('model') && lower.includes('not support'))
  );
}

export function shouldRetryWithoutResponseFormat(error: unknown): boolean {
  if (error instanceof AiAnalysisError && error.code === 'GROQ_EMPTY_RESPONSE') {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const status = readErrorStatus(error);

  if (isResponseFormatError(message)) return true;
  if (status === 400 && message.toLowerCase().includes('response')) return true;

  return false;
}

export function diagnoseClassifierError(error: unknown): ClassifierDiagnostic {
  if (error instanceof AiAnalysisError) {
    if (error.code === 'GROQ_NOT_CONFIGURED') {
      return {
        code: 'GROQ_API_KEY_MISSING',
        internalMessage: 'GROQ_API_KEY missing',
        errorName: error.name,
        httpStatus: error.statusCode,
        groqErrorCode: error.code,
      };
    }

    if (error.code === 'GROQ_EMPTY_RESPONSE') {
      return {
        code: 'GROQ_EMPTY_RESPONSE',
        internalMessage: 'Classifier returned empty response',
        errorName: error.name,
        httpStatus: error.statusCode,
        groqErrorCode: error.code,
      };
    }

    if (error.code === 'GROQ_RATE_LIMIT') {
      return {
        code: 'GROQ_RATE_LIMIT',
        internalMessage: 'Groq rate limit',
        errorName: error.name,
        httpStatus: error.statusCode,
        groqErrorCode: error.code,
      };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const sanitized = sanitizeDiagnosticText(message);
  const lower = sanitized.toLowerCase();
  const httpStatus = readErrorStatus(error);
  const groqErrorCode = readErrorCode(error);
  const errorName = error instanceof Error ? error.name : 'Error';

  if (lower.includes('missing required environment variable: groq_api_key') || lower.includes('groq_api_key')) {
    return {
      code: 'GROQ_API_KEY_MISSING',
      internalMessage: 'GROQ_API_KEY missing',
      errorName,
      httpStatus,
      groqErrorCode,
    };
  }

  if (httpStatus === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      code: 'GROQ_RATE_LIMIT',
      internalMessage: 'Groq rate limit',
      errorName,
      httpStatus,
      groqErrorCode,
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    groqErrorCode === 'ETIMEDOUT'
  ) {
    return {
      code: 'GROQ_TIMEOUT',
      internalMessage: 'Groq request timeout',
      errorName,
      httpStatus,
      groqErrorCode,
    };
  }

  if (isResponseFormatError(sanitized) || httpStatus === 400) {
    return {
      code: 'GROQ_MODEL_ERROR',
      internalMessage: `Groq model or response format error: ${sanitized}`,
      errorName,
      httpStatus,
      groqErrorCode,
    };
  }

  if (httpStatus === 404 || lower.includes('model') && lower.includes('not found')) {
    return {
      code: 'GROQ_MODEL_ERROR',
      internalMessage: `Groq model or response format error: ${sanitized}`,
      errorName,
      httpStatus,
      groqErrorCode,
    };
  }

  return {
    code: 'CLASSIFIER_UNKNOWN_ERROR',
    internalMessage: `Unknown classifier error: ${sanitized}`,
    errorName,
    httpStatus,
    groqErrorCode,
  };
}
