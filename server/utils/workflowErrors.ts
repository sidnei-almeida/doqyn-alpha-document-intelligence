import type { VercelResponse } from '@vercel/node';
import { AiAnalysisError } from '../ai/utils/errors.js';
import { isDocumentRulesNotSeededError } from '../services/documentRulesService.js';

export type WorkflowErrorCategory =
  | 'configuration'
  | 'authentication'
  | 'permission'
  | 'database'
  | 'ai'
  | 'upload'
  | 'storage'
  | 'unexpected';

export type WorkflowErrorAction = {
  label: string;
  href: string;
};

export type WorkflowErrorBody = {
  code: string;
  category: WorkflowErrorCategory;
  title: string;
  message: string;
  suggestion?: string;
  action?: WorkflowErrorAction;
  devHint?: string;
  technicalDetail?: string;
};

export type WorkflowErrorApiResponse = {
  message: string;
  code: string;
  error: WorkflowErrorBody;
  requestId?: string;
};

export const RULES_ADMIN_HREF = '/rules';

const DEV_DB_SETUP_HINT =
  'Ambiente de desenvolvimento: execute npm run db:setup para popular classes e regras iniciais.';

export function isDevelopmentEnvironment(): boolean {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  return appEnv === 'development' || nodeEnv === 'development' || (!appEnv && nodeEnv !== 'production');
}

export function buildDocumentRulesNotConfiguredError(
  technicalDetail?: string,
): WorkflowErrorBody {
  return {
    code: 'DOCUMENT_RULES_NOT_CONFIGURED',
    category: 'configuration',
    title: 'Configuração documental incompleta',
    message:
      'Não há classes e regras de documentos configuradas para esta empresa. Para analisar documentos, cadastre ao menos uma classe documental e uma regra ativa.',
    suggestion: 'Cadastre ao menos uma classe documental e uma regra ativa.',
    action: {
      label: 'Ir para Regras',
      href: RULES_ADMIN_HREF,
    },
    devHint: isDevelopmentEnvironment() ? DEV_DB_SETUP_HINT : undefined,
    technicalDetail,
  };
}

const ERROR_REGISTRY: Record<string, Omit<WorkflowErrorBody, 'code'> & { code?: string }> = {
  DOCUMENT_RULES_NOT_CONFIGURED: buildDocumentRulesNotConfiguredError(),
  RULES_NOT_SEEDED: buildDocumentRulesNotConfiguredError(),
  CLASS_OR_RULE_NOT_FOUND: {
    category: 'configuration',
    title: 'Configuração documental incompleta',
    message:
      'A classe ou regra usada na análise não está mais disponível. Verifique as regras documentais da empresa.',
    suggestion: 'Acesse Administração > Regras e confirme que a classe e a regra estão ativas.',
    action: {
      label: 'Ir para Regras',
      href: RULES_ADMIN_HREF,
    },
    devHint: isDevelopmentEnvironment() ? DEV_DB_SETUP_HINT : undefined,
  },
  GROQ_NOT_CONFIGURED: {
    category: 'ai',
    title: 'Análise automática indisponível',
    message: 'O serviço de inteligência artificial não está configurado no servidor.',
    suggestion: 'Entre em contato com o administrador do sistema.',
    devHint: isDevelopmentEnvironment()
      ? 'Ambiente de desenvolvimento: configure GROQ_API_KEY no servidor.'
      : undefined,
  },
  GROQ_RATE_LIMIT: {
    category: 'ai',
    title: 'Análise automática temporariamente indisponível',
    message: 'O limite de uso da análise automática foi atingido.',
    suggestion: 'Aguarde alguns minutos e tente novamente.',
  },
  INVALID_SESSION: {
    category: 'authentication',
    title: 'Sessão expirada',
    message: 'Sua sessão não é mais válida.',
    suggestion: 'Faça login novamente para continuar.',
  },
  FORBIDDEN: {
    category: 'permission',
    title: 'Sem permissão',
    message: 'Você não tem permissão para executar esta ação.',
    suggestion: 'Solicite acesso ao administrador da empresa.',
  },
  MONGODB_NOT_CONFIGURED: {
    category: 'database',
    title: 'Persistência indisponível',
    message: 'O banco de dados não está configurado no servidor.',
    suggestion: 'Tente novamente mais tarde ou contate o suporte.',
    devHint: isDevelopmentEnvironment()
      ? 'Ambiente de desenvolvimento: configure MONGODB_URI no servidor.'
      : undefined,
  },
  FILE_TOO_LARGE: {
    category: 'upload',
    title: 'Arquivo muito grande',
    message: 'O arquivo enviado excede o limite permitido.',
    suggestion: 'Envie um arquivo menor ou divida o documento.',
  },
  STORAGE_NOT_CONFIGURED: {
    category: 'storage',
    title: 'Armazenamento indisponível',
    message: 'O armazenamento de arquivos não está configurado.',
    suggestion: 'Tente novamente mais tarde ou contate o suporte.',
  },
  STORAGE_PERSISTENCE_FAILED: {
    category: 'storage',
    title: 'Falha ao salvar arquivo',
    message: 'Não foi possível persistir o arquivo do documento.',
    suggestion: 'Tente enviar o documento novamente.',
  },
  STAGING_FILE_NOT_FOUND: {
    category: 'storage',
    title: 'Arquivo original não encontrado',
    message: 'O arquivo temporário da análise expirou ou não foi encontrado.',
    suggestion: 'Refaça a análise do documento e confirme novamente.',
  },
};

function stripDevOnlyFields(body: WorkflowErrorBody): WorkflowErrorBody {
  if (isDevelopmentEnvironment()) {
    return body;
  }
  return {
    code: body.code,
    category: body.category,
    title: body.title,
    message: body.message,
    suggestion: body.suggestion,
    action: body.action,
  };
}

export function resolveWorkflowErrorBody(
  code: string,
  fallbackMessage: string,
  technicalDetail?: string,
): WorkflowErrorBody {
  const template = ERROR_REGISTRY[code];
  if (template) {
    return stripDevOnlyFields({
      code,
      category: template.category,
      title: template.title,
      message: template.message,
      suggestion: template.suggestion,
      action: template.action,
      devHint: template.devHint,
      technicalDetail: technicalDetail ?? template.technicalDetail,
    });
  }

  return stripDevOnlyFields({
    code,
    category: 'unexpected',
    title: 'Não foi possível concluir a operação',
    message: fallbackMessage,
    suggestion: 'Tente novamente. Se o problema persistir, contate o suporte.',
    technicalDetail: isDevelopmentEnvironment() ? technicalDetail : undefined,
  });
}

export function buildWorkflowErrorApiResponse(input: {
  code: string;
  message: string;
  technicalDetail?: string;
  requestId?: string;
}): WorkflowErrorApiResponse {
  const error = resolveWorkflowErrorBody(input.code, input.message, input.technicalDetail);
  return {
    message: error.message,
    code: error.code,
    error,
    ...(input.requestId ? { requestId: input.requestId } : {}),
  };
}

export function sendWorkflowError(
  res: VercelResponse,
  statusCode: number,
  input: {
    code: string;
    message: string;
    technicalDetail?: string;
    requestId?: string;
  },
): void {
  res.status(statusCode).json(buildWorkflowErrorApiResponse(input));
}

export function workflowErrorFromUnknown(
  error: unknown,
  context?: { requestId?: string; defaultCode?: string },
): { statusCode: number; body: WorkflowErrorApiResponse } {
  if (error instanceof AiAnalysisError) {
    return {
      statusCode: error.statusCode,
      body: buildWorkflowErrorApiResponse({
        code: error.code,
        message: error.message,
        technicalDetail: error.message,
        requestId: context?.requestId,
      }),
    };
  }

  if (isDocumentRulesNotSeededError(error)) {
    const body = buildDocumentRulesNotConfiguredError(error.message);
    return {
      statusCode: error.statusCode,
      body: {
        message: body.message,
        code: body.code,
        error: stripDevOnlyFields(body),
        ...(context?.requestId ? { requestId: context.requestId } : {}),
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Erro inesperado.';
  const code = context?.defaultCode ?? 'UNEXPECTED_ERROR';

  return {
    statusCode: 500,
    body: buildWorkflowErrorApiResponse({
      code,
      message,
      technicalDetail: message,
      requestId: context?.requestId,
    }),
  };
}
