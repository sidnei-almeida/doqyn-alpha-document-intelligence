import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { changePassword, ChangePasswordError } from '@/features/settings/api/changePasswordApi';

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
      label: 'Mínimo de 8 caracteres',
      met: password.length >= 8,
    },
    {
      id: 'letters',
      label: 'Contém letras',
      met: /[A-Za-zÀ-ÿ]/.test(password),
    },
    {
      id: 'numbers',
      label: 'Contém números',
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
  if (!password) return { level: 'empty', label: 'Digite a nova senha' };
  const metCount = requirements.filter((item) => item.met).length;
  if (metCount <= 1) return { level: 'weak', label: 'Fraca' };
  if (metCount === 2) return { level: 'medium', label: 'Média' };
  return { level: 'strong', label: 'Forte' };
}

export function ChangePasswordForm({ className }: ChangePasswordFormProps) {
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
      setFieldErrors({ currentPassword: 'Informe a senha atual.' });
      return;
    }
    if (form.newPassword.length < 8) {
      setFieldErrors({ newPassword: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'A confirmação não confere com a nova senha.' });
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
      toast.success(result.message ?? 'Senha alterada com sucesso.');
    } catch (error) {
      if (error instanceof ChangePasswordError) {
        if (error.status === 401) {
          toast.error('Sessão expirada. Faça login novamente.');
          return;
        }
        if (error.code === 'INVALID_CURRENT_PASSWORD') {
          setFieldErrors({ currentPassword: 'Senha atual incorreta.' });
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
          setFieldErrors({ confirmPassword: 'A confirmação não confere com a nova senha.' });
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.error('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={cn('space-y-4', className)} onSubmit={handleSubmit} autoComplete="off">
      <Input
        id="currentPassword"
        label="Senha atual"
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
          label="Nova senha"
          type="password"
          revealable
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(event) => updateField('newPassword', event.target.value)}
          error={fieldErrors.newPassword}
          disabled={submitting}
        />

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

        <ul className="settings-password-checklist" aria-label="Requisitos da senha">
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
      </div>
      <Input
        id="confirmPassword"
        label="Confirmar nova senha"
        type="password"
        revealable
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={(event) => updateField('confirmPassword', event.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={submitting}
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Salvando…' : 'Alterar senha'}
      </Button>
    </form>
  );
}
