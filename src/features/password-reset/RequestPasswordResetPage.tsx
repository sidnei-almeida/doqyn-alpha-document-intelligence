import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Input } from '@/components/ui/Input';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { AUTH_PRIMARY_BUTTON } from '@/features/auth/components/authControls';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/apiErrors';
import { passwordResetApi } from './api/passwordResetApi';

/**
 * `/forgot-password` — o botão "Esqueci minha senha" do login leva aqui.
 *
 * O servidor nunca diz "esse e-mail não existe" (`request-password-reset` sempre devolve `200`),
 * então a tela também não tenta adivinhar: a confirmação depois de enviar é sempre a mesma,
 * exista ou não a conta com aquele endereço. O único erro real é falha de rede/servidor.
 */
export function RequestPasswordResetPage() {
  const { t } = useTranslation('auth');

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await passwordResetApi.requestReset(email);
      setDevToken(result.resetToken ?? null);
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.friendlyMessage : t('requestPasswordResetPage.requestFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <AuthHeading
          title={t('requestPasswordResetPage.confirmationTitle')}
          description={t('requestPasswordResetPage.confirmationDescription')}
        />
        {devToken ? (
          <p className="text-caption text-doqyn-muted">
            {t('requestPasswordResetPage.devToken')} {devToken}
          </p>
        ) : null}
        <AuthFooterLink>
          <Link to="/login" className="text-doqyn-action underline-offset-4 hover:underline">
            {t('requestPasswordResetPage.backToLogin')}
          </Link>
        </AuthFooterLink>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={t('requestPasswordResetPage.title')}
        description={t('requestPasswordResetPage.description')}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="email"
          label={t('requestPasswordResetPage.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        {errorMessage ? <AlertBanner variant="error" message={errorMessage} /> : null}

        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}
        >
          {submitting
            ? t('requestPasswordResetPage.sending')
            : t('requestPasswordResetPage.submit')}
        </button>
      </form>

      <AuthFooterLink>
        <Link to="/login" className="text-doqyn-action underline-offset-4 hover:underline">
          {t('requestPasswordResetPage.backToLogin')}
        </Link>
      </AuthFooterLink>
    </>
  );
}
