import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { GoogleGlyph, MicrosoftGlyph } from '@/features/auth/components/BrandGlyph';
import { useAuth } from '@/features/auth/useAuth';
import { AUTH_MODE } from '@/lib/constants';
import { ApiError } from '@/lib/apiErrors';
import { SessionApiError } from '@/auth/sessionApi';
import { fetchEnabledOAuthProviders, type OAuthProvider } from '@/auth/oauthLogin';
import { getAuthErrorActions, getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';
import { getLoginAlertTitle, getLoginAlertVariant } from '@/pages/login/loginFeedback';

/* Canto de 4px, altura de 44px e nada de sombra: canto seco e superfície chapada
   leem como instrumento. O SSO fica em contorno para que o acento preenchido
   sobre apenas na ação principal do formulário. */
const CONTROL_BASE =
  'inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[4px] text-label font-medium ' +
  'transition-colors duration-[var(--transition-duration-fast)] ease-[var(--ease-standard)] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg ' +
  'disabled:pointer-events-none disabled:opacity-45';

const SSO_BUTTON =
  CONTROL_BASE +
  ' border border-doqyn-border bg-transparent text-doqyn-text hover:border-doqyn-border-strong hover:bg-doqyn-hover';

const PRIMARY_BUTTON =
  CONTROL_BASE +
  ' mt-1 bg-doqyn-accent-active text-doqyn-on-accent hover:bg-doqyn-accent-hover ' +
  'disabled:bg-doqyn-card disabled:text-doqyn-subtle';

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
    <>
      <AuthHeading title="Entrar no sistema" />

      {supportsOAuth && enabledProviders.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {enabledProviders.includes('google') && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => loginWithGoogle(from)}
              className={SSO_BUTTON}
            >
              <GoogleGlyph />
              Continuar com Google
            </button>
          )}
          {enabledProviders.includes('microsoft') && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => loginWithMicrosoft(from)}
              className={SSO_BUTTON}
            >
              <MicrosoftGlyph />
              Continuar com Microsoft
            </button>
          )}

          {showCredentialForm && (
            <div className="flex items-center gap-3 py-3">
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            required
          />

          <Input
            id="password"
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            revealable
            required
          />

          <div className="flex items-center justify-between gap-3">
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label={<span className="text-caption text-doqyn-muted">Lembrar acesso</span>}
              wrapperClassName="items-center"
            />
            <button
              type="button"
              className="text-caption text-doqyn-muted underline-offset-4 transition-colors hover:text-doqyn-text hover:underline"
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

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className={PRIMARY_BUTTON}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}

      {!showCredentialForm && error ? (
        <AlertBanner
          variant={getLoginAlertVariant(errorCode)}
          title={getLoginAlertTitle(errorCode)}
          message={error}
        />
      ) : null}

      <AuthFooterLink>
        Não tem acesso ainda?{' '}
        <Link
          to="/acesso"
          className="text-doqyn-accent-active underline-offset-4 transition-colors hover:underline"
        >
          Criar acesso
        </Link>
      </AuthFooterLink>
    </>
  );
}
