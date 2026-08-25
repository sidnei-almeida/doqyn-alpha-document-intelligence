import { useAuth } from '@/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { SettingsRegisterList } from '../SettingsRegisterList';
import { SettingsSaveBar } from '../SettingsSaveBar';
import { TrashRetentionSettingsSection } from './TrashRetentionSettingsSection';
import { UploadAiSettingsSection } from './UploadAiSettingsSection';
import { governsOrganization } from '../../settingsSections';
import { useOrganizationSettings } from '../../hooks/useOrganizationSettings';

/**
 * Uma tela só, em coluna única de blocos separados por fio, com uma regra de salvamento:
 * nada vale até confirmar na barra do fim. Quem não administra em PJ continua vendo o
 * bloco de envio e IA — em leitura —, porque é ele que explica o que a IA fez com o arquivo.
 */
export function OrganizationSection() {
  const { hasAnyRole, tenant } = useAuth();
  const governs = governsOrganization({
    tenantType: tenant?.tenantType,
    isCompanyAdmin: hasAnyRole(['company_admin']),
  });
  const canAccessRules = canAccessRulesPage(hasAnyRole);
  const { upload, trashRetention, dirty, saving, save, discard } = useOrganizationSettings({
    governs,
  });

  const canEdit = upload.canManage || governs;

  return (
    <div className="settings-blocks">
      <section className="settings-block">
        <SettingsSectionHeader
          title="Envio e IA"
          description="Vale para toda a organização: quando a IA renomeia o arquivo e quando o envio para para revisão."
          className="settings-block__header"
        />
        <UploadAiSettingsSection
          draft={upload.draft}
          onChange={upload.setDraft}
          canManage={upload.canManage}
          dirty={upload.dirty}
        />
      </section>

      {governs ? (
        <section className="settings-block">
          <SettingsSectionHeader
            title="Retenção da lixeira"
            description="Por quanto tempo um documento excluído continua recuperável."
            className="settings-block__header"
          />
          <TrashRetentionSettingsSection
            draft={trashRetention.draft}
            onChange={trashRetention.setDraft}
            isLoading={trashRetention.isLoading}
          />
        </section>
      ) : null}

      {canAccessRules ? (
        <section className="settings-block">
          <SettingsSectionHeader
            title="Governança"
            description="Onde a classificação, os fluxos e a visibilidade são definidos."
            className="settings-block__header"
          />
          <SettingsRegisterList
            entries={[
              {
                icon: 'balance',
                title: 'Regras e governança',
                description:
                  'Políticas de classificação, fluxos de aprovação e mapeamento entre categorias e grupos.',
                href: '/rules',
                linkLabel: 'Abrir Regras',
              },
              {
                icon: 'group',
                title: 'Grupos de acesso',
                description: 'Grupos vinculados às regras de visibilidade e permissões por área.',
                href: '/users',
                linkLabel: 'Gerenciar usuários',
              },
            ]}
          />

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

      {canEdit ? (
        <SettingsSaveBar
          className="settings-save-bar--screen"
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={discard}
        />
      ) : null}
    </div>
  );
}
