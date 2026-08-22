export type OAuthProvider = 'google' | 'microsoft';

export function getOAuthStartUrl(provider: OAuthProvider, returnUrl?: string): string {
  const params = new URLSearchParams();
  if (returnUrl?.trim()) {
    params.set('returnUrl', returnUrl);
  }
  const query = params.toString();
  return `/oauth/${provider}/start${query ? `?${query}` : ''}`;
}

export function redirectToOAuth(provider: OAuthProvider, returnUrl?: string): void {
  window.location.assign(getOAuthStartUrl(provider, returnUrl));
}

export function isOAuthEnabled(): boolean {
  return import.meta.env.VITE_AUTH_PROVIDER === 'doqyn_auth';
}

/**
 * Provedores realmente habilitados no auth-service.
 *
 * `isOAuthEnabled()` só diz que o app usa `doqyn_auth`; não diz quais provedores estão configurados.
 * Sem consultar isto, a tela desenhava os dois botões e quem clicasse num provedor sem credencial
 * recebia um JSON de 404 `OAUTH_PROVIDER_DISABLED`. Botão que existe tem de funcionar.
 *
 * Falha de rede devolve lista vazia: melhor esconder o botão do que oferecer um caminho quebrado —
 * o login por e-mail e senha continua disponível de qualquer forma.
 */
export async function fetchEnabledOAuthProviders(): Promise<OAuthProvider[]> {
  if (!isOAuthEnabled()) return [];

  try {
    const response = await fetch('/oauth/providers', { credentials: 'omit' });
    if (!response.ok) return [];

    const data: unknown = await response.json();
    const providers = (data as { providers?: unknown })?.providers;
    if (!Array.isArray(providers)) return [];

    return providers.filter((p): p is OAuthProvider => p === 'google' || p === 'microsoft');
  } catch {
    return [];
  }
}
