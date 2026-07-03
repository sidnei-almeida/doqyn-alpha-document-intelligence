const PREVIEW_ERROR_MESSAGES: Record<string, string> = {
  PREVIEW_NOT_READY: 'O preview ainda não está disponível para este documento.',
  PREVIEW_FAILED: 'Não foi possível gerar o preview deste documento.',
  PREVIEW_NOT_FOUND: 'Preview não encontrado para este documento.',
  DOCUMENT_ACCESS_DENIED: 'Você não tem permissão para visualizar este documento.',
  DOCUMENT_NOT_FOUND: 'Documento não encontrado.',
  DOCUMENT_FORBIDDEN: 'Você não tem permissão para visualizar este documento.',
  SESSION_EXPIRED: 'Sua sessão expirou. Faça login novamente.',
  UNAUTHORIZED: 'Sua sessão expirou. Faça login novamente.',
};

function resolveErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function getPreviewErrorMessage(error: unknown): string {
  const code = resolveErrorCode(error);
  if (code && PREVIEW_ERROR_MESSAGES[code]) {
    return PREVIEW_ERROR_MESSAGES[code];
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Não foi possível carregar o preview agora.';
}

export function getPreviewStatusLabel(status?: string): string {
  switch (status) {
    case 'ready':
      return 'Preview disponível';
    case 'failed':
      return 'Falha no preview';
    case 'skipped':
      return 'Preview pendente';
    case 'missing':
      return 'Sem preview';
    default:
      return 'Preview indisponível';
  }
}
