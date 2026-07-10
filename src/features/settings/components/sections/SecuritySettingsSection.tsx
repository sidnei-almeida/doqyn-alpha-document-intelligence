import { Icon } from '@/components/ui/Icon';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsInfoCard } from '../SettingsInfoCard';

type SecurityFeature = {
  icon: string;
  title: string;
  description: string;
  status: 'ok' | 'pending';
  href?: string;
};

const SECURITY_FEATURES: SecurityFeature[] = [
  {
    icon: 'shield',
    title: 'Auditoria documental',
    description:
      'Todas as ações relevantes — upload, preview, download, alterações e acessos negados — são registradas para investigação.',
    status: 'ok',
    href: '/tracking',
  },
  {
    icon: 'history_toggle_off',
    title: 'Histórico de versões',
    description:
      'Versões de documentos são preservadas no histórico da organização para rastreabilidade e conformidade.',
    status: 'ok',
  },
  {
    icon: 'visibility',
    title: 'Preview e visualização',
    description:
      'Previews respeitam permissões do usuário. Visualizações podem ser registradas no tracking documental.',
    status: 'ok',
    href: '/tracking',
  },
  {
    icon: 'download',
    title: 'Downloads controlados',
    description:
      'Downloads exigem permissão explícita. Tentativas negadas ficam registradas para auditoria.',
    status: 'ok',
  },
  {
    icon: 'verified_user',
    title: 'Dados sanitizados',
    description:
      'Logs e tracking não armazenam conteúdo de documentos, OCR integral, tokens ou URLs de storage em texto bruto.',
    status: 'ok',
    href: '/audit',
  },
];

export function SecuritySettingsSection() {
  const total = SECURITY_FEATURES.length;
  const activeCount = SECURITY_FEATURES.filter((feature) => feature.status === 'ok').length;

  return (
    <SettingsSectionBody>
      <div className="settings-summary-bar" role="status" aria-live="polite">
        <div className="settings-summary-bar__label">
          <Icon name="verified_user" size={14} aria-hidden />
          <span>Recursos de segurança</span>
        </div>
        <div className="settings-summary-bar__values">
          <span className="settings-summary-bar__chip">
            {activeCount} de {total} recursos de segurança ativos
          </span>
        </div>
      </div>

      <div className="settings-cards-grid settings-cards-grid--balanced">
        {SECURITY_FEATURES.map((feature) => (
          <SettingsInfoCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            status={feature.status}
            href={feature.href}
          />
        ))}
      </div>
    </SettingsSectionBody>
  );
}
