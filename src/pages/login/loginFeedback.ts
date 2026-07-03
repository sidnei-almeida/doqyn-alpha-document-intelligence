import type { AlertBannerVariant } from '@/components/ui/AlertBanner';

export function getLoginAlertVariant(code: string | null): AlertBannerVariant {
  if (!code) return 'error';

  if (
    code === 'MEMBERSHIP_PENDING' ||
    code === 'NO_ACTIVE_TENANT' ||
    code === 'TENANT_REQUIRED'
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
    default:
      return undefined;
  }
}
