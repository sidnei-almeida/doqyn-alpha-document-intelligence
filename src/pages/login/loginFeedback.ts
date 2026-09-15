import type { AlertBannerVariant } from '@/components/ui/AlertBanner';
import { i18n } from '@/i18n';
import ptPages from '@/i18n/catalog/pt-BR/pages.json';

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

type LoginAlertTitle = keyof typeof ptPages.loginFeedback.title;

const TITLE_BY_CODE: Record<string, LoginAlertTitle> = {
  INVALID_CREDENTIALS: 'invalidCredentials',
  USER_DISABLED: 'userDisabled',
  MEMBERSHIP_PENDING: 'membershipPending',
  MEMBERSHIP_BLOCKED: 'membershipBlocked',
  MEMBERSHIP_REJECTED: 'membershipRejected',
  NO_ACTIVE_MEMBERSHIP: 'noActiveMembership',
  SESSION_EXPIRED: 'sessionExpired',
  INVALID_SESSION: 'sessionExpired',
  OAUTH_EMAIL_NOT_VERIFIED: 'oauthEmailNotVerified',
  OAUTH_CALLBACK_FAILED: 'oauthUnavailable',
  OAUTH_PROVIDER_DISABLED: 'oauthUnavailable',
};

/**
 * O título no idioma ativo, com o `pt-BR` embutido como rede.
 *
 * Chamado também fora da tela de login — e em teste, onde o catálogo `pages` não foi carregado.
 * Sem a rede, o título viraria a chave crua.
 */
export function getLoginAlertTitle(code: string | null): string | undefined {
  const title = code ? TITLE_BY_CODE[code] : undefined;
  if (!title) return undefined;
  const key = `pages:loginFeedback.title.${title}`;
  return i18n.exists(key) ? i18n.t(key) : ptPages.loginFeedback.title[title];
}
