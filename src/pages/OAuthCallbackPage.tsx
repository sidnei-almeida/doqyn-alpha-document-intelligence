import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { AuthBrandLogo } from '@/components/brand';
import { useAuth } from '@/features/auth/useAuth';
import { clearSessionScopedCaches } from '@/auth/clearSessionScopedCaches';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { i18n } from '@/i18n';

function resolveDestination(input: {
  status: string | null;
  isAuthenticated: boolean;
  accessGate: string | null;
  returnUrl: string | null;
}): string | null {
  if (input.status === 'error') {
    return '/login';
  }

  if (input.status === 'onboarding_required' || input.accessGate === 'no_membership') {
    return '/onboarding';
  }

  if (input.accessGate === 'pending') {
    return null;
  }

  if (input.isAuthenticated) {
    const safeReturn =
      input.returnUrl && input.returnUrl.startsWith('/') && !input.returnUrl.startsWith('//')
        ? input.returnUrl
        : '/biblioteca';
    return safeReturn;
  }

  if (input.status === 'membership_pending') {
    return null;
  }

  return '/login';
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser, isAuthenticated, accessGate, isLoading } = useAuth();
  const [message, setMessage] = useState(() => i18n.t('pages:oauthCallback.completing'));

  useEffect(() => {
    const status = searchParams.get('status');

    if (status === 'error') {
      const code = searchParams.get('code') ?? 'OAUTH_CALLBACK_FAILED';
      const oauthMessage = searchParams.get('message') ?? i18n.t('pages:oauthCallback.failed');
      navigate(
        `/login?oauthCode=${encodeURIComponent(code)}&oauthMessage=${encodeURIComponent(oauthMessage)}`,
        {
          replace: true,
        },
      );
      return;
    }

    clearSessionScopedCaches();
    void refreshUser().catch(() => {
      setMessage(i18n.t('pages:oauthCallback.sessionFailed'));
      navigate('/login', { replace: true });
    });
  }, [navigate, refreshUser, searchParams]);

  useEffect(() => {
    // Enquanto a sessão está sendo carregada, `isAuthenticated` ainda é falso e o destino
    // calculado seria o fallback `/login` — justamente para quem acabou de autenticar.
    if (isLoading) return;

    const status = searchParams.get('status');
    const destination = resolveDestination({
      status,
      isAuthenticated,
      accessGate,
      returnUrl: searchParams.get('returnUrl'),
    });

    if (destination) {
      navigate(destination, { replace: true });
    }
  }, [accessGate, isAuthenticated, isLoading, navigate, searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-doqyn-bg px-4">
      <AuthBrandLogo />
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon
          name="progress_activity"
          className="animate-spin text-doqyn-muted"
          size={ICON_SIZE.md}
        />
        <p className="text-sm text-doqyn-muted">{message}</p>
      </div>
    </main>
  );
}
