import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { GoogleGlyph, MicrosoftGlyph } from '@/features/auth/components/BrandGlyph';
import {
  AUTH_PRIMARY_BUTTON,
  AUTH_SECONDARY_BUTTON,
} from '@/features/auth/components/authControls';
import { useAuth } from '@/features/auth/useAuth';
import { ApiError } from '@/lib/apiErrors';
import { SessionApiError } from '@/auth/sessionApi';
import { fetchEnabledOAuthProviders, type OAuthProvider } from '@/auth/oauthLogin';
import { getAuthErrorActions, getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';
import { getLoginAlertTitle, getLoginAlertVariant } from '@/pages/login/loginFeedback';
import { storeVerificationTicket } from '@/features/email-verification/verificationTicket';
import { useTranslation } from 'react-i18next';

/** O passe de confirmação viaja em `details` porque é o campo que a rota de login já repassa. */
function extractVerificationTicket(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'EMAIL_NOT_VERIFIED') return null;
  const ticket = (error.details as { verificationTicket?: unknown } | undefined)
    ?.verificationTicket;
  return typeof ticket === 'string' && ticket ? ticket : null;
}

export function Login() {
  const { t } = useTranslation('pages');

  const { login, loginWithGoogle, loginWithMicrosoft } = useAuth();
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

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/library';

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
      // Senha certa, e-mail ainda não confirmado: o auth-service já mandou o código junto com a
      // recusa, então a tela seguinte pede os dígitos em vez de um botão de "enviar".
      const ticket = extractVerificationTicket(err);
      if (ticket) {
        storeVerificationTicket(ticket);
        navigate('/verify-email', { replace: true, state: { ticket } });
        return;
      }

      if (err instanceof ApiError || err instanceof SessionApiError) {
        setErrorCode(err.code);
        setError(err.friendlyMessage);
        return;
      }
      setError(t('login.falhaGenerica'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading title={t('login.entrarNoSistema')} />

      {enabledProviders.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {enabledProviders.includes('google') && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => loginWithGoogle(from)}
              className={cn(AUTH_SECONDARY_BUTTON, 'w-full')}
            >
              <GoogleGlyph />

              {t('login.continuarComGoogle')}
            </button>
          )}
          {enabledProviders.includes('microsoft') && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => loginWithMicrosoft(from)}
              className={cn(AUTH_SECONDARY_BUTTON, 'w-full')}
            >
              <MicrosoftGlyph />

              {t('login.continuarComMicrosoft')}
            </button>
          )}

          <div className="flex items-center gap-3 py-3">
            <span className="h-px flex-1 bg-doqyn-border-subtle" />
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
              {t('login.or')}
            </span>
            <span className="h-px flex-1 bg-doqyn-border-subtle" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="email"
          label={t('login.eMail')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('login.emailPlaceholder')}
          autoComplete="email"
          required
        />

        <Input
          id="password"
          label={t('login.senha')}
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
            label={
              <span className="text-caption text-doqyn-muted">{t('login.lembrarAcesso')}</span>
            }
            wrapperClassName="items-center"
          />
          <Link
            to="/forgot-password"
            className="text-caption text-doqyn-muted underline-offset-4 transition-colors hover:text-doqyn-text hover:underline"
          >
            {t('login.esqueciMinhaSenha')}
          </Link>
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
          className={cn(AUTH_PRIMARY_BUTTON, 'mt-1 w-full')}
        >
          {isSubmitting ? t('login.entrando') : t('login.entrar')}
        </button>
      </form>

      <AuthFooterLink>
        {t('login.naoTemAcessoAinda')}{' '}
        <Link
          to="/access"
          className="text-doqyn-accent-active underline-offset-4 transition-colors hover:underline"
        >
          {t('login.criarAcesso')}
        </Link>
      </AuthFooterLink>
    </>
  );
}
