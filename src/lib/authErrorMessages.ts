export type ApiErrorDetails = Record<string, unknown>;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  USER_DISABLED: 'Esta conta foi desativada. Entre em contato com o administrador.',
  PASSWORD_CHANGE_REQUIRED: 'Você precisa alterar sua senha antes de continuar.',
  NO_ACTIVE_MEMBERSHIP: 'Sua conta ainda não possui acesso ativo a nenhuma empresa.',
  NO_ACTIVE_TENANT: 'Selecione uma empresa para continuar.',
  TENANT_REQUIRED: 'Esta ação exige uma empresa ativa.',
  TENANT_NOT_FOUND: 'Empresa não encontrada ou indisponível para sua conta.',
  TENANT_INACTIVE: 'Esta empresa não está ativa no DOQYN.',
  TENANT_PROVISIONING_FAILED:
    'O ambiente desta empresa ainda não está pronto. Tente novamente em alguns minutos ou contate o suporte.',
  MEMBERSHIP_PENDING: 'Sua solicitação de acesso ainda está aguardando aprovação.',
  MEMBERSHIP_BLOCKED: 'Seu acesso a esta empresa foi bloqueado.',
  MEMBERSHIP_REJECTED: 'Sua solicitação de acesso a esta empresa foi rejeitada.',
  MEMBERSHIP_REMOVED: 'Você não faz mais parte desta empresa no DOQYN.',
  MEMBERSHIP_NOT_ACTIVE: 'Sua associação a esta empresa não está ativa.',
  SESSION_EXPIRED: 'Sua sessão expirou. Faça login novamente.',
  INVALID_SESSION: 'Sua sessão expirou. Faça login novamente.',
  AUTH_REQUIRED: 'Faça login para continuar.',
  NO_SESSION: 'Faça login para continuar.',
  FORBIDDEN: 'Você não tem permissão para acessar esta área.',
  DOQYN_ADMIN_REQUIRED: 'Esta ação é restrita a administradores da plataforma.',
  COMPANY_ADMIN_REQUIRED: 'Esta ação é restrita a administradores da empresa.',
  VALIDATION_ERROR: 'Revise os campos informados e tente novamente.',
  TERMS_ACCEPTANCE_REQUIRED: 'É necessário aceitar os Termos e Condições de Uso para continuar.',
  TERMS_VERSION_INVALID: 'A versão dos Termos e Condições enviada não é válida.',
  AUTH_SERVICE_UNAVAILABLE: 'Não foi possível validar sua sessão agora. Tente novamente.',
  RATE_LIMIT: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  USER_NOT_ACTIVE: 'Esta conta não está ativa.',
};

export function getFriendlyAuthErrorMessage(
  code: string,
  fallbackMessage?: string,
  details?: ApiErrorDetails,
): string {
  if (code === 'MEMBERSHIP_REJECTED' && typeof details?.rejectionReason === 'string') {
    const reason = details.rejectionReason.trim();
    if (reason) {
      return `Sua solicitação de acesso foi rejeitada. Motivo informado: ${reason}`;
    }
  }

  return AUTH_ERROR_MESSAGES[code] ?? fallbackMessage ?? 'Não foi possível concluir a ação agora. Tente novamente.';
}

export function getAuthErrorActions(code: string): Array<{ label: string; href: string }> {
  switch (code) {
    case 'NO_ACTIVE_MEMBERSHIP':
      return [
        { label: 'Solicitar acesso a uma empresa', href: '/solicitar-acesso' },
        { label: 'Cadastrar uma empresa', href: '/criar-empresa' },
      ];
    case 'MEMBERSHIP_REJECTED':
    case 'MEMBERSHIP_REMOVED':
      return [{ label: 'Solicitar acesso a uma empresa', href: '/solicitar-acesso' }];
    default:
      return [];
  }
}
