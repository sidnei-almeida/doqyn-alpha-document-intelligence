import { SettingsFieldGroup } from './SettingsFieldGroup';
import { ChangePasswordForm } from './ChangePasswordForm';

export function PasswordChangeCard() {
  return (
    <SettingsFieldGroup
      title="Alterar senha"
      description="Atualize sua senha de acesso. Outras sessões ativas serão encerradas."
    >
      <ChangePasswordForm className="max-w-lg" />
    </SettingsFieldGroup>
  );
}
