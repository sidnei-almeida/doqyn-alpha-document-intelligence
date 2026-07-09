import { APP_NAME, AUTH_MODE, AUTH_PROVIDER, AUTH_PROVIDER_LABELS } from '@/lib/constants';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsInfoCard } from '../SettingsInfoCard';

const APP_VERSION = '0.1.0';

function envLabel(): string {
  if (import.meta.env.PROD) return 'Produção';
  if (import.meta.env.MODE === 'staging') return 'Homologação';
  return 'Desenvolvimento';
}

export function SystemSettingsSection() {
  const authKey = AUTH_PROVIDER || AUTH_MODE;
  const authLabel = AUTH_PROVIDER_LABELS[authKey] ?? authKey;

  return (
    <SettingsSectionBody>
      <SettingsCard>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="settings-dt">Aplicação</dt>
            <dd className="settings-dd">{APP_NAME}</dd>
          </div>
          <div>
            <dt className="settings-dt">Versão</dt>
            <dd className="settings-dd">{APP_VERSION}</dd>
          </div>
          <div>
            <dt className="settings-dt">Ambiente</dt>
            <dd className="settings-dd">{envLabel()}</dd>
          </div>
          <div>
            <dt className="settings-dt">Autenticação</dt>
            <dd className="settings-dd">{authLabel}</dd>
          </div>
          <div>
            <dt className="settings-dt">Armazenamento</dt>
            <dd className="settings-dd">Objeto na nuvem (R2)</dd>
          </div>
          <div>
            <dt className="settings-dt">Build</dt>
            <dd className="settings-dd">{import.meta.env.MODE}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[11px] text-doqyn-subtle">
          Nomes de bucket e credenciais não são exibidos por segurança. Consulte o dashboard
          administrativo para métricas de storage quando disponíveis.
        </p>
      </SettingsCard>

      <div className="settings-cards-grid">
        <SettingsInfoCard
          icon="database"
          title="Storage de documentos"
          description="Arquivos originais e previews são armazenados com isolamento por tenant."
          status="ok"
        />
        <SettingsInfoCard
          icon="power"
          title="Status de integrações"
          description="Painel unificado de saúde de serviços externos e filas de processamento."
          status="pending"
        />
        <SettingsInfoCard
          icon="desktop_windows"
          title="Telemetria operacional"
          description="Métricas de uso, filas e latência para administradores."
          status="pending"
        />
      </div>
    </SettingsSectionBody>
  );
}
