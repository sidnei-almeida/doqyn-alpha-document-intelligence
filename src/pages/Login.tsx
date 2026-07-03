import { KeyRound, Lock, Shield } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { DoqynLogo } from '@/components/brand';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/features/auth/useAuth';
import { AUTH_MODE } from '@/lib/constants';
import { ApiError } from '@/lib/apiErrors';
import { SessionApiError } from '@/auth/sessionApi';
import { getAuthErrorActions } from '@/lib/authErrorMessages';
import { getLoginAlertTitle, getLoginAlertVariant } from '@/pages/login/loginFeedback';

export function Login() {
  const { login, loginWithSSO, supportsSso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState(false);

  const showCredentialForm =
    AUTH_MODE === 'temporary' || AUTH_MODE === 'mock' || import.meta.env.VITE_AUTH_PROVIDER === 'doqyn_auth';
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/upload';

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

  async function handleSsoLogin() {
    setError(null);
    setErrorCode(null);
    setIsSsoLoading(true);

    try {
      await loginWithSSO();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar o SSO.');
      setIsSsoLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="lg" align="center" showSubtitle subtitle="Document Intelligence" />
          <p className="mt-4 text-sm text-doqyn-muted">
            Plataforma corporativa para gestão segura de documentos e rastreabilidade.
          </p>
        </div>

        <div className="rounded-xl border border-doqyn-border bg-doqyn-surface p-6">
          <h2 className="mb-1 text-base font-semibold text-doqyn-text">Entrar no sistema</h2>
          <p className="mb-5 text-xs text-doqyn-muted">
            {supportsSso
              ? 'Use SSO corporativo ou suas credenciais de acesso.'
              : 'Acesse sua área para enviar e gerenciar documentos.'}
          </p>

          {supportsSso && (
            <div className="mb-4 space-y-3">
              <Button
                type="button"
                className="w-full"
                disabled={isSsoLoading || isSubmitting}
                onClick={() => void handleSsoLogin()}
              >
                <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                {isSsoLoading ? 'Redirecionando...' : 'Entrar com SSO corporativo'}
              </Button>

              {showCredentialForm && (
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-doqyn-border-subtle" />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-doqyn-subtle">
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
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                required
              />

              <div className="flex items-center justify-between">
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

              {error && (
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
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || isSsoLoading || !email.trim() || !password}
              >
                <Lock className="h-4 w-4" strokeWidth={1.5} />
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          )}

          {!showCredentialForm && error && (
            <AlertBanner
              variant={getLoginAlertVariant(errorCode)}
              title={getLoginAlertTitle(errorCode)}
              message={error}
              className="mt-2"
            />
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-doqyn-subtle">
          <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ambiente corporativo seguro
        </p>
        <p className="mt-3 text-center text-sm">
          <Link to="/acesso" className="text-doqyn-accent hover:underline">
            Não tem acesso ainda?
          </Link>
        </p>
      </div>
    </main>
  );
}
