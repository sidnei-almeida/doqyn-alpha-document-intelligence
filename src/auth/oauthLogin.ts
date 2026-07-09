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
