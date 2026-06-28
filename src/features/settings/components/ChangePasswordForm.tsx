import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { changePassword, ChangePasswordError } from '@/features/settings/api/changePasswordApi';

const EMPTY_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function ChangePasswordForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>(
    {},
  );

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
    <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
      <Input
        id="currentPassword"
        label="Senha atual"
        type="password"
        autoComplete="current-password"
        value={form.currentPassword}
        onChange={(event) => updateField('currentPassword', event.target.value)}
        error={fieldErrors.currentPassword}
        disabled={submitting}
      />
      <Input
        id="newPassword"
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={(event) => updateField('newPassword', event.target.value)}
        error={fieldErrors.newPassword}
        disabled={submitting}
      />
      <p className="text-xs text-doqyn-subtle">
        Mínimo de 8 caracteres, com letras e números.
      </p>
      <Input
        id="confirmPassword"
        label="Confirmar nova senha"
        type="password"
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
