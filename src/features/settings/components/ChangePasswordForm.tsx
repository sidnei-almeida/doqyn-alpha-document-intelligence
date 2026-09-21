import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { changePassword, ChangePasswordError } from '@/features/settings/api/changePasswordApi';
import { i18n } from '@/i18n';
import { useTranslation } from 'react-i18next';

const EMPTY_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

type ChangePasswordFormProps = {
  className?: string;
};

type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

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
      // Sem acentuadas, porque o servidor também não as aceita: validatePasswordStrength usa
      // /[a-zA-Z]/. Com À-ÿ aqui, "çãoção1234" marcava o requisito como cumprido e mostrava
      // "Forte", e só então o servidor recusava por senha fraca — a lista afirmava algo falso.
      // (À-ÿ ainda pegava × e ÷, que não são letra em lugar nenhum.)
      met: /[a-zA-Z]/.test(password),
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

export function ChangePasswordForm({ className }: ChangePasswordFormProps) {
  const { t } = useTranslation('settings');

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>(
    {},
  );

  const requirements = getPasswordRequirements(form.newPassword);
  const strength = getPasswordStrength(form.newPassword, requirements);

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    if (!form.currentPassword.trim()) {
      setFieldErrors({ currentPassword: t('changePasswordForm.currentRequired') });
      return;
    }
    if (form.newPassword.length < 8) {
      setFieldErrors({ newPassword: t('changePasswordForm.tooShort') });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: t('changePasswordForm.mismatch') });
      return;
    }

    setSubmitting(true);
    try {
      const result = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      setForm(EMPTY_FORM);
      // A frase do servidor é português e existe para log; a confirmação sai do catálogo.
      void result;
      toast.success(t('changePasswordForm.changed'));
    } catch (error) {
      if (error instanceof ChangePasswordError) {
        if (error.status === 401) {
          toast.error(t('changePasswordForm.sessionExpired'));
          return;
        }
        if (error.code === 'INVALID_CURRENT_PASSWORD') {
          setFieldErrors({ currentPassword: t('changePasswordForm.wrongCurrent') });
          return;
        }
        if (error.code === 'WEAK_PASSWORD') {
          setFieldErrors({ newPassword: error.message });
          return;
        }
        if (error.code === 'PASSWORD_UNCHANGED') {
          setFieldErrors({ newPassword: error.message });
          return;
        }
        if (error.code === 'VALIDATION_ERROR') {
          setFieldErrors({ confirmPassword: t('changePasswordForm.mismatch') });
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.error(t('changePasswordForm.changeFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className={cn('settings-form-measure space-y-4', className)}
      onSubmit={handleSubmit}
      autoComplete="off"
    >
      <Input
        id="currentPassword"
        variant="rule"
        label={t('changePasswordForm.senhaAtual')}
        type="password"
        revealable
        autoComplete="current-password"
        value={form.currentPassword}
        onChange={(event) => updateField('currentPassword', event.target.value)}
        error={fieldErrors.currentPassword}
        disabled={submitting}
      />
      <div className="space-y-2">
        <Input
          id="newPassword"
          variant="rule"
          label={t('changePasswordForm.novaSenha')}
          type="password"
          revealable
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(event) => updateField('newPassword', event.target.value)}
          error={fieldErrors.newPassword}
          disabled={submitting}
        />

        {/* Força e requisitos só aparecem depois da primeira tecla.

            Antes de digitar, três bolinhas apagadas e uma barra vazia leem como erro já cometido —
            a tela cobra antes de a pessoa tentar. Elas existem para guiar quem está escrevendo, e é
            só nesse momento que dizem algo. */}
        {form.newPassword.length > 0 && (
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
              aria-label={t('changePasswordForm.requisitosDaSenha')}
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
        label={t('changePasswordForm.confirmarNovaSenha')}
        type="password"
        revealable
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={(event) => updateField('confirmPassword', event.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={submitting}
      />
      <div className="settings-block__action settings-block__action--end">
        <Button type="submit" variant="secondary" size="sm" disabled={submitting}>
          {submitting ? t('changePasswordForm.saving') : t('changePasswordForm.submit')}
        </Button>
      </div>
    </form>
  );
}
