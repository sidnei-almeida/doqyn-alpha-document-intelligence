import { SettingsSectionBody } from '../SettingsSectionBody';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { ChangeEmailCard } from '../ChangeEmailCard';
import { useTranslation } from 'react-i18next';

/**
 * Acesso é o que a pessoa faz com a própria conta: trocar senha e trocar e-mail. Cada um
 * confirma o seu — provedor, cookie e OAuth são detalhe de infraestrutura e não aparecem.
 */
export function AuthenticationSettingsSection() {
  const { t } = useTranslation('settings');

  return (
    <SettingsSectionBody>
      <div className="settings-subblock">
        <div className="settings-subblock__header">
          <p className="register-label text-doqyn-subtle">
            {t('authenticationSettingsSection.alterarSenha')}
          </p>
          <p className="settings-section-note">
            {t('authenticationSettingsSection.aoTrocarASenha')}
          </p>
        </div>
        <ChangePasswordForm />
      </div>

      <ChangeEmailCard />
    </SettingsSectionBody>
  );
}
