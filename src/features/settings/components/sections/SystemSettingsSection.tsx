import { useState } from 'react';
import { APP_NAME, AUTH_MODE, AUTH_PROVIDER, AUTH_PROVIDER_LABELS } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsFieldGroup } from '../SettingsFieldGroup';
import { SettingsInfoCard } from '../SettingsInfoCard';

const APP_VERSION = '0.1.0';

function envLabel(): string {
  if (import.meta.env.PROD) return 'Produção';
  if (import.meta.env.MODE === 'staging') return 'Homologação';
  return 'Desenvolvimento';
}

type SystemFact = {
  icon: string;
  label: string;
  value: string;
};

function SystemFactRow({ icon, label, value }: SystemFact) {
  return (
    <div className="settings-system-fact">
      <span className="settings-system-fact__icon" aria-hidden>
        <Icon name={icon} size={ICON_SIZE.xs} />
      </span>
      <div className="settings-system-fact__copy min-w-0">
        <dt className="settings-system-fact__label">{label}</dt>
        <dd className="settings-system-fact__value">{value}</dd>
      </div>
    </div>
  );
}

function SystemFactGroup({
  title,
  items,
}: {
  title: string;
  items: SystemFact[];
}) {
  return (
    <div className="settings-system-group">
      <p className="settings-system-group__title">{title}</p>
      <dl className="settings-system-group__list">
        {items.map((item) => (
          <SystemFactRow key={item.label} {...item} />
        ))}
      </dl>
    </div>
  );
}

export function SystemSettingsSection() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const authKey = AUTH_PROVIDER || AUTH_MODE;
  const authLabel = AUTH_PROVIDER_LABELS[authKey] ?? authKey;

  const identityFacts: SystemFact[] = [
    { icon: 'apps', label: 'Aplicação', value: APP_NAME },
    { icon: 'sell', label: 'Versão', value: APP_VERSION },
  ];

  const infrastructureFacts: SystemFact[] = [
    { icon: 'lock', label: 'Autenticação', value: authLabel },
    { icon: 'cloud', label: 'Armazenamento', value: 'Objeto na nuvem (R2)' },
  ];

  const advancedFacts: SystemFact[] = [
    { icon: 'dns', label: 'Ambiente', value: envLabel() },
    { icon: 'terminal', label: 'Build', value: import.meta.env.MODE },
  ];

  return (
    <SettingsSectionBody>
      <SettingsFieldGroup
        title="Sobre o sistema"
        description="Identidade da aplicação e infraestrutura em uso neste ambiente."
      >
        <div className="settings-system-overview">
          <SystemFactGroup title="Identidade" items={identityFacts} />
          <SystemFactGroup title="Infraestrutura" items={infrastructureFacts} />
        </div>

        <div className="settings-system-advanced">
          <button
            type="button"
            className="settings-system-advanced__toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            {advancedOpen ? 'Ocultar detalhes avançados' : 'Ver detalhes avançados'}
            <Icon
              name="expand_more"
              size={16}
              className={cn('transition-transform', advancedOpen && 'rotate-180')}
              aria-hidden
            />
          </button>

          {advancedOpen ? (
            <div className="settings-system-advanced__panel">
              <SystemFactGroup title="Ambiente de execução" items={advancedFacts} />
            </div>
          ) : null}
        </div>

        <p className="settings-system-note">
          Nomes de bucket e credenciais não são exibidos por segurança. Consulte o dashboard
          administrativo para métricas de storage quando disponíveis.
        </p>
      </SettingsFieldGroup>

      <div className="settings-cards-grid settings-cards-grid--3col">
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
