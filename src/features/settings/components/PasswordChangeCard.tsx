import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { SettingsFieldGroup } from './SettingsFieldGroup';
import { ChangePasswordForm } from './ChangePasswordForm';

export function PasswordChangeCard() {
  return (
    <SettingsFieldGroup
      title="Alterar senha"
      description="Atualize sua senha de acesso. Outras sessões ativas serão encerradas."
    >
      <div className="flex items-start gap-3">
        <span className="settings-info-card__icon mt-0.5" aria-hidden>
          <Icon name="key" size={ICON_SIZE.xs} />
        </span>
        <ChangePasswordForm className="min-w-0 flex-1 max-w-lg" />
      </div>
    </SettingsFieldGroup>
  );
}
