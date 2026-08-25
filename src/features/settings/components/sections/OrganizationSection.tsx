import { useAuth } from '@/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { SettingsInfoCard } from '../SettingsInfoCard';
import { TenantEmailSettingsSection } from './TenantEmailSettingsSection';
import { TrashRetentionSettingsSection } from './TrashRetentionSettingsSection';
import { UploadAiSettingsSection } from './UploadAiSettingsSection';
import { governsOrganization } from '../../settingsSections';

/**
 * Uma tela só, em blocos separados por fio. Quem não administra em PJ continua vendo o
 * bloco de envio e IA — em leitura —, porque é ele que explica o que a IA fez com o arquivo.
 */
export function OrganizationSection() {
  const { hasAnyRole, tenant } = useAuth();
  const governs = governsOrganization({
    tenantType: tenant?.tenantType,
    isCompanyAdmin: hasAnyRole(['company_admin']),
  });
  const canAccessRules = canAccessRulesPage(hasAnyRole);

  return (
    <div className="settings-blocks">
      <section className="settings-block">
        <SettingsSectionHeader
          title="Envio e IA"
          description="Vale para toda a organização: quando a IA renomeia o arquivo e quando o envio para para revisão."
          className="settings-block__header"
        />
        <UploadAiSettingsSection />
      </section>

      {governs ? (
        <section className="settings-block">
          <SettingsSectionHeader
            title="Retenção da lixeira"
            description="Por quanto tempo um documento excluído continua recuperável."
            className="settings-block__header"
          />
          <TrashRetentionSettingsSection />
        </section>
      ) : null}

      {governs ? (
        <section className="settings-block">
          <SettingsSectionHeader
            title="E-mail de saída"
            description="Servidor SMTP usado para convites e avisos da organização."
            className="settings-block__header"
          />
          <TenantEmailSettingsSection />
        </section>
      ) : null}

      {canAccessRules ? (
        <section className="settings-block">
          <SettingsSectionHeader
            title="Governança"
            description="Onde a classificação, os fluxos e a visibilidade são definidos."
            className="settings-block__header"
          />
          <div className="settings-cards-grid settings-cards-grid--2col">
            <SettingsInfoCard
              icon="balance"
              title="Regras e governança"
              description="Políticas de classificação, fluxos de aprovação e mapeamento entre categorias e grupos."
              status="ok"
              featured
              href="/rules"
              linkLabel="Abrir Regras"
            />
            <SettingsInfoCard
              icon="group"
              title="Grupos de acesso"
              description="Grupos vinculados às regras de visibilidade e permissões por área."
              status="ok"
              href="/users"
              linkLabel="Gerenciar usuários"
            />
          </div>

          <aside className="settings-callout" role="note">
            <span className="settings-callout__icon" aria-hidden>
              <Icon name="info" size={18} />
            </span>
            <p className="settings-callout__body">
              Alterações em <strong className="font-medium text-doqyn-text">Regras</strong> impactam
              classificação automática, alertas e permissões na Biblioteca.
            </p>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
