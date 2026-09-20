import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { AUTH_PRIMARY_BUTTON } from '@/features/auth/components/authControls';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/apiErrors';
import { genericFailureMessage } from '@/lib/authErrorMessages';
import { i18n } from '@/i18n';
import { useTranslation } from 'react-i18next';
import { passwordResetApi } from './api/passwordResetApi';

type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

// Copiado literalmente de `ChangePasswordForm.tsx` — mesma regra, mesmas chaves de
// `settings:changePasswordForm.req.*`/`strength.*`, só reaproveitadas por fora de Settings.
function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'length',
      label: i18n.t('settings:changePasswordForm.req.length'),
      met: password.length >= 8,
    },
    {
      id: 'letters',
      label: i18n.t('settings:changePasswordForm.req.letters'),
      met: /[A-Za-zÀ-ÿ]/.test(password),
    },
    {
      id: 'numbers',
      label: i18n.t('settings:changePasswordForm.req.numbers'),
      met: /\d/.test(password),
    },
  ];
}

function getPasswordStrength(
  password: string,
  requirements: PasswordRequirement[],
): {
  level: 'empty' | 'weak' | 'medium' | 'strong';
  label: string;
} {
  if (!password) {
    return { level: 'empty', label: i18n.t('settings:changePasswordForm.strength.empty') };
  }
  const metCount = requirements.filter((item) => item.met).length;
  if (metCount <= 1) {
    return { level: 'weak', label: i18n.t('settings:changePasswordForm.strength.weak') };
  }
  if (metCount === 2) {
    return { level: 'medium', label: i18n.t('settings:changePasswordForm.strength.medium') };
  }
  return { level: 'strong', label: i18n.t('settings:changePasswordForm.strength.strong') };
}

/**
 * `/reset-password/:token` — o link que o e-mail de redefinição já manda.
 *
 * `resetPassword` do servidor é o único endpoint de auth que devolve erro de negócio sem `code`;
 * `passwordResetApi.resetPassword` já traduziu a frase em `RESET_REASON_TO_CODE`, então esta tela
 * só decide o que fazer com o `code` resultante. Token inválido/expirado/já usado é terminal —
 * tentar de novo com o mesmo token nunca funciona. Os demais códigos mantêm a pessoa no
 * formulário, porque limite de tentativas passa e queda de rede é transitória.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'settings']);

  const { token } = useParams<{ token: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [view, setView] = useState<'form' | 'broken' | 'done'>('form');
  const [brokenMessage, setBrokenMessage] = useState('');

  const requirements = getPasswordRequirements(newPassword);
  const strength = getPasswordStrength(newPassword, requirements);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !token) return;

    setFieldErrors({});
    setFormError(null);

    if (newPassword.length < 8) {
      setFieldErrors({ newPassword: t('resetPasswordPage.tooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: t('resetPasswordPage.mismatch') });
      return;
    }

    setSubmitting(true);
    try {
      await passwordResetApi.resetPassword(token, newPassword);
      // Sem `navigate` do roteador aqui, e sem `logout()`: o servidor acabou de revogar todas as
      // sessões, mas o `AuthProvider` desta aba não sabe disso — ele só reconsulta `/api/me` ao
      // montar, e não a cada navegação do SPA. Um `navigate('/login')` seria lido pelo
      // `PublicRoute` com `isAuthenticated` velho e jogaria a pessoa na biblioteca, onde toda
      // requisição responde 401. `logout()` também não serve: ele espera o `logoutRequest`, que
      // pode falhar justamente porque a sessão já morreu, e aí o `clearSession` nunca roda.
      // A vista abaixo termina aqui, e o botão dela recarrega a página de verdade.
      setView('done');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PASSWORD_RESET_TOKEN_INVALID' || err.code === 'PASSWORD_RESET_TOKEN_USED') {
          setBrokenMessage(err.friendlyMessage);
          setView('broken');
          return;
        }
        if (err.code === 'PASSWORD_RESET_WEAK_PASSWORD') {
          setFieldErrors({ newPassword: err.friendlyMessage });
          return;
        }
        setFormError(err.friendlyMessage);
        return;
      }
      // Rede caiu antes de o servidor responder: nem `ApiError` nem `code`, só a rede genérica.
      setFormError(genericFailureMessage());
    } finally {
      setSubmitting(false);
    }
  }

  if (view === 'done') {
    return (
      <>
        <AuthHeading
          title={t('resetPasswordPage.doneTitle')}
          description={t('resetPasswordPage.resetSuccess')}
        />
        <button
          type="button"
          className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}
          // Navegação dura de propósito: recarregar remonta o `AuthProvider`, que reconsulta
          // `/api/me`, recebe 401 e só então a tela de login aparece de verdade.
          onClick={() => window.location.assign('/login')}
        >
          {t('resetPasswordPage.backToLogin')}
        </button>
      </>
    );
  }

  if (view === 'broken') {
    return (
      <>
        <AuthHeading title={t('resetPasswordPage.linkBrokenTitle')} description={brokenMessage} />
        <Link to="/forgot-password" className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}>
          {t('resetPasswordPage.requestNewLink')}
        </Link>
        <AuthFooterLink>
          <Link to="/login" className="text-doqyn-action underline-offset-4 hover:underline">
            {t('resetPasswordPage.backToLogin')}
          </Link>
        </AuthFooterLink>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={t('resetPasswordPage.title')}
        description={t('resetPasswordPage.description')}
      />

      {formError ? <AlertBanner variant="error" message={formError} /> : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="space-y-2">
          <Input
            id="newPassword"
            variant="rule"
            label={t('resetPasswordPage.newPassword')}
            type="password"
            revealable
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
            }}
            error={fieldErrors.newPassword}
            disabled={submitting}
          />

          {newPassword.length > 0 && (
            <>
              <div
                className="settings-password-strength"
                data-level={strength.level}
                aria-live="polite"
              >
                <div className="settings-password-strength__track" aria-hidden>
                  <span className="settings-password-strength__segment" />
                  <span className="settings-password-strength__segment" />
                  <span className="settings-password-strength__segment" />
                </div>
                <p className="settings-password-strength__label">{strength.label}</p>
              </div>

              <ul
                className="settings-password-checklist"
                aria-label={t('settings:changePasswordForm.requisitosDaSenha')}
              >
                {requirements.map((requirement) => (
                  <li
                    key={requirement.id}
                    className={cn(
                      'settings-password-checklist__item',
                      requirement.met && 'settings-password-checklist__item--met',
                    )}
                  >
                    <Icon
                      name={requirement.met ? 'check_circle' : 'radio_button_unchecked'}
                      size={14}
                      filled={requirement.met}
                      aria-hidden
                    />
                    <span>{requirement.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <Input
          id="confirmPassword"
          variant="rule"
          label={t('resetPasswordPage.confirmPassword')}
          type="password"
          revealable
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          error={fieldErrors.confirmPassword}
          disabled={submitting}
        />

        <button
          type="submit"
          disabled={submitting || !token || !newPassword || !confirmPassword}
          className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}
        >
          {submitting ? t('resetPasswordPage.submitting') : t('resetPasswordPage.submit')}
        </button>
      </form>

      <AuthFooterLink>
        <Link to="/login" className="text-doqyn-action underline-offset-4 hover:underline">
          {t('resetPasswordPage.backToLogin')}
        </Link>
      </AuthFooterLink>
    </>
  );
}
