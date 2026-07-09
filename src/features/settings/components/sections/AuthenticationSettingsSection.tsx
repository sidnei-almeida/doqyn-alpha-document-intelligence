import { getAuthProviderType, usesDoqynAuth } from '@/auth/authConfig';
import { AUTH_MODE_LABELS, AUTH_PROVIDER_LABELS } from '@/lib/constants';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsInfoCard } from '../SettingsInfoCard';
import { PasswordChangeCard } from '../PasswordChangeCard';

function authProviderNote(provider: ReturnType<typeof getAuthProviderType>): string | null {
  switch (provider) {
    case 'doqyn_auth':
      return 'Sessão segura via cookie HttpOnly com doqyn-auth-service.';
    case 'temporary':
      return 'Desenvolvimento: credenciais via API com sessão em cookie.';
    case 'mock':
      return 'Modo mock para desenvolvimento local.';
    default:
      return null;
  }
}

export function AuthenticationSettingsSection() {
  const authProvider = getAuthProviderType();
  const authLabel = AUTH_PROVIDER_LABELS[authProvider] ?? AUTH_MODE_LABELS[authProvider] ?? authProvider;
  const providerNote = authProviderNote(authProvider);

  return (
    <SettingsSectionBody>
      <SettingsCard>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="settings-dt">Modo</dt>
            <dd className="settings-dd">{authLabel}</dd>
          </div>
          <div>
            <dt className="settings-dt">Provedor</dt>
            <dd className="settings-dd">{AUTH_PROVIDER_LABELS[authProvider] ?? authProvider}</dd>
          </div>
          <div>
            <dt className="settings-dt">Sessão</dt>
            <dd className="settings-dd">Cookie seguro · renovação automática</dd>
          </div>
          <div>
            <dt className="settings-dt">OAuth</dt>
            <dd className="settings-dd">Google / Microsoft quando configurado no tenant</dd>
          </div>
        </dl>
        {providerNote && <p className="mt-4 text-xs text-doqyn-subtle">{providerNote}</p>}
      </SettingsCard>

      {usesDoqynAuth() && <PasswordChangeCard />}

      <SettingsInfoCard
        icon="laptop_mac"
        title="Sessões ativas"
        description="Visualização e revogação de sessões em outros dispositivos."
        status="pending"
      />
    </SettingsSectionBody>
  );
}
