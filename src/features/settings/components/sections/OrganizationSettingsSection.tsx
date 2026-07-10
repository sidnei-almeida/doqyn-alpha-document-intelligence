import { Icon } from '@/components/ui/Icon';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsInfoCard } from '../SettingsInfoCard';
import { TenantEmailSettingsSection } from './TenantEmailSettingsSection';

export function OrganizationSettingsSection() {
  return (
    <SettingsSectionBody>
      <TenantEmailSettingsSection />

      <div className="settings-cards-grid settings-cards-grid--2col">
        <SettingsInfoCard
          icon="balance"
          title="Regras e governança"
          description="Defina políticas de classificação, fluxos de aprovação e mapeamento entre categorias e grupos."
          status="ok"
          featured
          href="/rules"
          linkLabel="Abrir Regras"
        />
        <SettingsInfoCard
          icon="sell"
          title="Categorias documentais"
          description="Taxonomia usada pela IA e pela Biblioteca para organizar e filtrar documentos."
          status="pending"
        />
        <SettingsInfoCard
          icon="group"
          title="Grupos de acesso"
          description="Grupos vinculados às regras de visibilidade e permissões por área."
          status="pending"
          href="/users"
          linkLabel="Gerenciar usuários"
        />
        <SettingsInfoCard
          icon="link"
          title="Integrações organizacionais"
          description="Conectores e sincronização com diretórios corporativos."
          status="pending"
        />
      </div>

      <aside className="settings-callout" role="note">
        <span className="settings-callout__icon" aria-hidden>
          <Icon name="info" size={18} />
        </span>
        <p className="settings-callout__body">
          A governança documental é configurada em{' '}
          <strong className="font-medium text-doqyn-text">Regras</strong>. Alterações impactam
          classificação automática, alertas e permissões na Biblioteca.
        </p>
      </aside>
    </SettingsSectionBody>
  );
}
