import type {
  WorkflowErrorApiResponse,
  WorkflowErrorBody,
  WorkflowErrorCategory,
  WorkflowErrorDisplay,
} from '../types/workflowError';

const SENSITIVE_PATTERNS = [
  /gsk_[a-zA-Z0-9]+/g,
  /sk-[a-zA-Z0-9]+/g,
  /mongodb(\+srv)?:\/\/[^\s]+/gi,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
];

export const WORKFLOW_ERROR_CATEGORY_LABELS: Record<WorkflowErrorCategory, string> = {
  configuration: 'Configuração',
  authentication: 'Autenticação',
  permission: 'Permissão',
  database: 'Banco de dados',
  ai: 'IA / OCR',
  upload: 'Upload',
  storage: 'Armazenamento',
  unexpected: 'Inesperado',
};

function sanitizeText(value: string, maxLength = 500): string {
  let text = value.replace(/\s+/g, ' ').trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, '[redigido]');
  }
  return text.slice(0, maxLength);
}

function fallbackError(message: string, code?: string): WorkflowErrorDisplay {
  const safeMessage = sanitizeText(message);
  return {
    code: code ?? 'UNEXPECTED_ERROR',
    category: 'unexpected',
    title: 'Não foi possível analisar o documento',
    message: safeMessage,
    suggestion: 'Tente novamente. Se o problema persistir, contate o suporte.',
    toastMessage: safeMessage,
  };
}

export function isDevelopmentClient(): boolean {
  return import.meta.env.DEV;
}

export function parseWorkflowErrorPayload(
  payload: WorkflowErrorApiResponse | null | undefined,
  fallbackMessage: string,
): WorkflowErrorDisplay {
  if (payload?.error) {
    const error = payload.error;
    return {
      ...error,
      message: sanitizeText(error.message),
      title: sanitizeText(error.title),
      suggestion: error.suggestion ? sanitizeText(error.suggestion) : undefined,
      devHint: error.devHint ? sanitizeText(error.devHint) : undefined,
      technicalDetail: error.technicalDetail
        ? sanitizeText(error.technicalDetail)
        : undefined,
      toastMessage: buildWorkflowToastMessage(error),
      requestId: payload.requestId,
    };
  }

  if (payload?.code || payload?.message) {
    return fallbackError(payload.message ?? fallbackMessage, payload.code);
  }

  return fallbackError(fallbackMessage);
}

export function buildWorkflowToastMessage(error: WorkflowErrorBody): string {
  if (error.code === 'DOCUMENT_RULES_NOT_CONFIGURED' || error.code === 'RULES_NOT_SEEDED') {
    return 'Configuração documental incompleta. Cadastre classes e regras antes de analisar documentos.';
  }

  return sanitizeText(error.message);
}

export function buildWorkflowErrorLogDetails(
  error: WorkflowErrorDisplay,
  options?: {
    stage?: string;
    endpoint?: string;
    showDebug?: boolean;
  },
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    errorType: WORKFLOW_ERROR_CATEGORY_LABELS[error.category],
    category: error.category,
    friendlyTitle: error.title,
    friendlyMessage: error.message,
    suggestion: error.suggestion,
  };

  if (error.action) {
    details.actionLabel = error.action.label;
    details.actionHref = error.action.href;
  }

  if (error.technicalDetail) {
    details.detail = error.technicalDetail;
  }

  if (options?.stage) {
    details.stage = options.stage;
  }

  if (options?.endpoint) {
    details.endpoint = options.endpoint;
  }

  if (options?.showDebug || isDevelopmentClient()) {
    if (error.devHint && isDevelopmentClient()) {
      details.devHint = error.devHint;
    }
    details.code = error.code;
    if (error.requestId) details.requestId = error.requestId;
    if (options?.endpoint) details.endpoint = options.endpoint;
  }

  return details;
}

export function shouldShowDevHint(showDebug: boolean): boolean {
  return isDevelopmentClient() || showDebug;
}
