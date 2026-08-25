import { usesDoqynAuth } from '@/auth/authConfig';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { ChangeEmailCard } from '../ChangeEmailCard';

/**
 * Acesso é o que a pessoa faz com a própria conta: trocar senha e trocar e-mail. Cada um
 * confirma o seu — provedor, cookie e OAuth são detalhe de infraestrutura e não aparecem.
 */
export function AuthenticationSettingsSection() {
  if (!usesDoqynAuth()) {
    return null;
  }

  return (
    <SettingsSectionBody>
      <div className="settings-subblock">
        <div className="settings-subblock__header">
          <p className="register-label text-doqyn-subtle">Alterar senha</p>
          <p className="settings-section-note">
            Ao trocar a senha, as outras sessões ativas são encerradas.
          </p>
        </div>
        <ChangePasswordForm />
      </div>

      <ChangeEmailCard />
    </SettingsSectionBody>
  );
}
