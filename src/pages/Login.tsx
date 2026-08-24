import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { AuthCard, AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/features/auth/useAuth';
import { AUTH_MODE } from '@/lib/constants';
import { ApiError } from '@/lib/apiErrors';
import { SessionApiError } from '@/auth/sessionApi';
import { fetchEnabledOAuthProviders, type OAuthProvider } from '@/auth/oauthLogin';
import { getAuthErrorActions, getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';
import { getLoginAlertTitle, getLoginAlertVariant } from '@/pages/login/loginFeedback';
import { ICON_SIZE } from '@/lib/iconDefaults';

export function Login() {
  const { login, loginWithGoogle, loginWithMicrosoft, supportsOAuth } = useAuth();
  const [enabledProviders, setEnabledProviders] = useState<OAuthProvider[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const oauthCode = searchParams.get('oauthCode');
  // A mensagem do auth-service vem na URL e é o último recurso: o texto que o usuário lê é o nosso,
  // pelo código, para que o app diga a mesma coisa em todo lugar e possa explicar a saída.
  const [error, setError] = useState<string | null>(
    oauthCode
      ? getFriendlyAuthErrorMessage(oauthCode, searchParams.get('oauthMessage') ?? undefined)
      : searchParams.get('oauthMessage'),
  );
  const [errorCode, setErrorCode] = useState<string | null>(oauthCode);

  // Só desenha botão de provedor que o auth-service tem configurado. Sem isto, clicar num provedor
  // sem credencial devolvia um JSON de 404 na cara do usuário.
  useEffect(() => {
    let active = true;
    void fetchEnabledOAuthProviders().then((providers) => {
      if (active) setEnabledProviders(providers);
    });
    return () => {
      active = false;
    };
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showCredentialForm =
    AUTH_MODE === 'temporary' ||
    AUTH_MODE === 'mock' ||
    import.meta.env.VITE_AUTH_PROVIDER === 'doqyn_auth';
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/biblioteca';

  const errorActions = errorCode ? getAuthErrorActions(errorCode) : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setIsSubmitting(true);

    try {
      await login(email, password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError || err instanceof SessionApiError) {
        setErrorCode(err.code);
        setError(err.friendlyMessage);
        return;
      }
      setError('Não foi possível concluir a ação agora. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      /* Sem eyebrow aqui: "Document Intelligence" é assinatura de marca, não
         orientação. Em /acesso o mesmo slot carrega "Primeiro acesso", que
         situa a pessoa no fluxo e por isso ganha o lugar. */
      title="Entrar no sistema"
      showSecureBadge
      footer={
        <Link to="/acesso" className="text-doqyn-accent-active transition-colors hover:underline">
          Não tem acesso ainda?
        </Link>
      }
    >
      <AuthCard className="p-6">
        {supportsOAuth && enabledProviders.length > 0 && (
          <div className="mb-4 space-y-2.5">
            {enabledProviders.includes('google') && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => loginWithGoogle(from)}
              >
                <Icon name="key" size={ICON_SIZE.sm} />
                Continuar com Google
              </Button>
            )}
            {enabledProviders.includes('microsoft') && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => loginWithMicrosoft(from)}
              >
                <Icon name="key" size={ICON_SIZE.sm} />
                Continuar com Microsoft
              </Button>
            )}

            {showCredentialForm && (
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-doqyn-border-subtle" />
                <span className="font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
                  ou
                </span>
                <span className="h-px flex-1 bg-doqyn-border-subtle" />
              </div>
            )}
          </div>
        )}

        {showCredentialForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@empresa.com"
              autoComplete="email"
              required
            />

            <Input
              id="password"
              label="Senha DOQYN"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />

            <div className="flex items-center justify-between gap-3">
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                label={<span className="text-xs text-doqyn-muted">Lembrar acesso</span>}
                wrapperClassName="items-center"
              />
              <button
                type="button"
                className="text-xs text-doqyn-muted transition-colors hover:text-doqyn-text"
              >
                Esqueci minha senha
              </button>
            </div>

            {error ? (
              <AlertBanner
                variant={getLoginAlertVariant(errorCode)}
                title={getLoginAlertTitle(errorCode)}
                message={error}
              >
                {errorActions.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {errorActions.map((action) => (
                      <Link key={action.href} to={action.href}>
                        <Button type="button" variant="secondary" className="w-full">
                          {action.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </AlertBanner>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !email.trim() || !password}
            >
              <Icon name="lock" size={ICON_SIZE.sm} />
              {isSubmitting ? 'Entrando...' : 'Entrar com e-mail e senha'}
            </Button>
          </form>
        )}

        {!showCredentialForm && error ? (
          <AlertBanner
            variant={getLoginAlertVariant(errorCode)}
            title={getLoginAlertTitle(errorCode)}
            message={error}
          />
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}
