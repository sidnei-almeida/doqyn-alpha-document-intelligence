import type { AlertBannerVariant } from '@/components/ui/AlertBanner';

export function getLoginAlertVariant(code: string | null): AlertBannerVariant {
  if (!code) return 'error';

  if (
    code === 'MEMBERSHIP_PENDING' ||
    code === 'NO_ACTIVE_TENANT' ||
    code === 'TENANT_REQUIRED' ||
    // Não é falha do sistema: o provedor simplesmente não provou posse do endereço. O caminho de
    // saída existe (senha, ou aprovação do administrador), então avisar vale mais que alarmar.
    code === 'OAUTH_EMAIL_NOT_VERIFIED'
  ) {
    return 'warning';
  }

  if (
    code === 'NO_ACTIVE_MEMBERSHIP' ||
    code === 'MEMBERSHIP_REJECTED' ||
    code === 'MEMBERSHIP_REMOVED'
  ) {
    return 'info';
  }

  return 'error';
}

export function getLoginAlertTitle(code: string | null): string | undefined {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Credenciais inválidas';
    case 'USER_DISABLED':
      return 'Conta desativada';
    case 'MEMBERSHIP_PENDING':
      return 'Aguardando aprovação';
    case 'MEMBERSHIP_BLOCKED':
      return 'Acesso bloqueado';
    case 'MEMBERSHIP_REJECTED':
      return 'Solicitação rejeitada';
    case 'NO_ACTIVE_MEMBERSHIP':
      return 'Sem empresa ativa';
    case 'SESSION_EXPIRED':
    case 'INVALID_SESSION':
      return 'Sessão expirada';
    case 'OAUTH_EMAIL_NOT_VERIFIED':
      return 'E-mail não verificado pelo provedor';
    case 'OAUTH_CALLBACK_FAILED':
    case 'OAUTH_PROVIDER_DISABLED':
      return 'Login social indisponível';
    default:
      return undefined;
  }
}
