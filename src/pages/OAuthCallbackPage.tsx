import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/useAuth';
import { ICON_SIZE } from '@/lib/iconDefaults';

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
      input.returnUrl &&
      input.returnUrl.startsWith('/') &&
      !input.returnUrl.startsWith('//')
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
  const { refreshUser, isAuthenticated, accessGate } = useAuth();
  const [message, setMessage] = useState('Concluindo autenticação...');

  useEffect(() => {
    const status = searchParams.get('status');

    if (status === 'error') {
      const code = searchParams.get('code') ?? 'OAUTH_CALLBACK_FAILED';
      const oauthMessage = searchParams.get('message') ?? 'Não foi possível concluir o login social.';
      navigate(`/login?oauthCode=${encodeURIComponent(code)}&oauthMessage=${encodeURIComponent(oauthMessage)}`, {
        replace: true,
      });
      return;
    }

    void refreshUser().catch(() => {
      setMessage('Não foi possível validar a sessão. Redirecionando...');
      navigate('/login', { replace: true });
    });
  }, [navigate, refreshUser, searchParams]);

  useEffect(() => {
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
  }, [accessGate, isAuthenticated, navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-doqyn-bg px-4">
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
