export type ApiErrorDetails = Record<string, unknown>;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  USER_DISABLED: 'Esta conta foi desativada. Entre em contato com o administrador.',
  EMAIL_NOT_VERIFIED:
    'Confirme seu e-mail para entrar. Enviamos um código de 6 dígitos para o endereço do cadastro.',
  EMAIL_VERIFICATION_INVALID_CODE: 'Código incorreto. Confira os seis dígitos do e-mail.',
  EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS:
    'Este código foi bloqueado por excesso de tentativas. Peça um novo.',
  EMAIL_VERIFICATION_EXPIRED: 'Este código expirou. Peça um novo.',
  EMAIL_VERIFICATION_ALREADY_USED: 'Esta confirmação já foi utilizada.',
  EMAIL_VERIFICATION_NOT_FOUND: 'Nenhum código pendente. Peça um novo.',
  EMAIL_VERIFICATION_RESEND_TOO_SOON: 'Aguarde um instante antes de pedir outro código.',
  EMAIL_VERIFICATION_TICKET_INVALID:
    'Esta confirmação expirou. Entre com e-mail e senha para receber um código novo.',
  EMAIL_ALREADY_VERIFIED: 'Este e-mail já está confirmado.',
  EMAIL_CHANGE_INVALID_CODE: 'Código incorreto. Confira os seis dígitos do e-mail.',
  EMAIL_CHANGE_TOO_MANY_ATTEMPTS:
    'Este código foi bloqueado por excesso de tentativas. Peça um novo.',
  EMAIL_CHANGE_RESEND_TOO_SOON: 'Aguarde um instante antes de pedir outro código.',
  EMAIL_CHANGE_NOT_FOUND: 'Nenhuma troca de e-mail pendente.',
  EMAIL_CHANGE_EXPIRED: 'Este link de troca expirou. Peça a alteração novamente.',
  EMAIL_CHANGE_ALREADY_USED: 'Esta troca de e-mail já foi confirmada.',
  PASSWORD_CHANGE_REQUIRED: 'Você precisa alterar sua senha antes de continuar.',
  // Espelho de `server/utils/membershipAccessErrors.ts`: estas disparam antes de haver tenant
  // resolvido, então não há tipo a consultar e "empresa" era um chute que errava em toda conta
  // pessoal.
  NO_ACTIVE_MEMBERSHIP: 'Sua conta ainda não tem acesso ativo a nenhum ambiente no DOQYN.',
  NO_ACTIVE_TENANT: 'Selecione um ambiente para continuar.',
  TENANT_REQUIRED: 'Esta ação exige um ambiente ativo.',
  TENANT_NOT_FOUND: 'Ambiente não encontrado ou indisponível para sua conta.',
  TENANT_INACTIVE: 'Este ambiente não está ativo no DOQYN.',
  TENANT_PROVISIONING_FAILED:
    'Este ambiente ainda não está pronto. Tente novamente em alguns minutos ou contate o suporte.',
  MEMBERSHIP_PENDING: 'Sua solicitação de acesso ainda está aguardando aprovação.',
  MEMBERSHIP_BLOCKED: 'Seu acesso a este ambiente foi bloqueado.',
  MEMBERSHIP_REJECTED: 'Sua solicitação de acesso a este ambiente foi rejeitada.',
  MEMBERSHIP_REMOVED: 'Você não faz mais parte deste ambiente no DOQYN.',
  MEMBERSHIP_NOT_ACTIVE: 'Seu vínculo com este ambiente não está ativo.',
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
  OAUTH_EMAIL_NOT_VERIFIED:
    'O provedor não confirmou que este e-mail é seu, então não podemos vincular a conta existente. Entre com e-mail e senha ou peça ao administrador para liberar o acesso.',
  OAUTH_CALLBACK_FAILED: 'Não foi possível concluir o login social. Tente novamente.',
  OAUTH_PROVIDER_DISABLED: 'Este provedor de login não está disponível no momento.',
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

  return (
    AUTH_ERROR_MESSAGES[code] ??
    fallbackMessage ??
    'Não foi possível concluir a ação agora. Tente novamente.'
  );
}

export function getAuthErrorActions(code: string): Array<{ label: string; href: string }> {
  switch (code) {
    case 'NO_ACTIVE_MEMBERSHIP':
      // `/acesso` apresenta os caminhos que a pessoa percorre sozinha, inclusive a conta
      // pessoal. Entrar numa empresa que já existe não está lá: depende de convite.
      return [{ label: 'Ver formas de acesso', href: '/acesso' }];
    case 'EMAIL_NOT_VERIFIED':
      return [{ label: 'Confirmar e-mail', href: '/confirmar-cadastro' }];
    case 'MEMBERSHIP_REJECTED':
    case 'MEMBERSHIP_REMOVED':
      // Sem ação: voltar depende de um convite novo, que sai das mãos de quem administra a
      // empresa. Um botão aqui levaria a uma tela onde a pessoa não resolve nada.
      return [];
    default:
      return [];
  }
}
