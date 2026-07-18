import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { getAuthErrorActions } from '@/lib/authErrorMessages';
import { getLoginAlertTitle, getLoginAlertVariant } from '@/pages/login/loginFeedback';
import { ICON_SIZE } from '@/lib/iconDefaults';

export function Login() {
  const { t } = useTranslation('auth');
  const { login, loginWithGoogle, loginWithMicrosoft, supportsOAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(searchParams.get('oauthMessage'));
  const [errorCode, setErrorCode] = useState<string | null>(searchParams.get('oauthCode'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showCredentialForm =
    AUTH_MODE === 'temporary' || AUTH_MODE === 'mock' || import.meta.env.VITE_AUTH_PROVIDER === 'doqyn_auth';
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
      setError(t('login.genericError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow={t('login.eyebrow')}
      title={t('login.title')}
      description={t('login.description')}
      showSecureBadge
      footer={
        <Link to="/acesso" className="text-doqyn-accent transition-colors hover:underline">
          {t('login.footerLink')}
        </Link>
      }
    >
      <AuthCard className="p-6">
        <p className="mb-5 text-xs text-doqyn-muted">
          {supportsOAuth ? t('login.hintOAuth') : t('login.hintNoOAuth')}
        </p>

        {supportsOAuth && (
          <div className="mb-4 space-y-2.5">
            <Button
              type="button"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => loginWithGoogle(from)}
            >
              <Icon name="key" size={ICON_SIZE.sm} />
              {t('login.continueWithGoogle')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => loginWithMicrosoft(from)}
            >
              <Icon name="key" size={ICON_SIZE.sm} />
              {t('login.continueWithMicrosoft')}
            </Button>

            {showCredentialForm && (
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-doqyn-border-subtle" />
                <span className="text-[10px] uppercase tracking-[0.12em] text-doqyn-subtle">
                  {t('login.or')}
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
              label={t('login.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="email"
              required
            />

            <Input
              id="password"
              label={t('login.passwordLabel')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />

            <div className="flex items-center justify-between gap-3">
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                label={<span className="text-xs text-doqyn-muted">{t('login.rememberMe')}</span>}
                wrapperClassName="items-center"
              />
              <button
                type="button"
                className="text-xs text-doqyn-muted transition-colors hover:text-doqyn-text"
              >
                {t('login.forgotPassword')}
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
              {isSubmitting ? t('login.submitting') : t('login.submit')}
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
