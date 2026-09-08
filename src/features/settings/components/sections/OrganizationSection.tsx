import { useAuth } from '@/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { SettingsRegisterList } from '../SettingsRegisterList';
import { SettingsSaveBar } from '../SettingsSaveBar';
import { StorageUsageSection } from './StorageUsageSection';
import { TrashRetentionSettingsSection } from './TrashRetentionSettingsSection';
import { UploadAiSettingsSection } from './UploadAiSettingsSection';
import { governsOrganization } from '../../settingsSections';
import { tenantVocabulary } from '@/lib/tenantVocabulary';
import { useOrganizationSettings } from '../../hooks/useOrganizationSettings';
import { useTranslation } from 'react-i18next';

/**
 * Uma tela só, em coluna única de blocos separados por fio, com uma regra de salvamento:
 * nada vale até confirmar na barra do fim. Quem não administra em PJ continua vendo o
 * bloco de envio e IA — em leitura —, porque é ele que explica o que a IA fez com o arquivo.
 */
export function OrganizationSection() {
  const { t } = useTranslation('settings');

  const { hasAnyRole, tenant } = useAuth();
  const isCompanyAdmin = hasAnyRole(['company_admin']);
  const governs = governsOrganization({
    tenantType: tenant?.tenantType,
    isCompanyAdmin,
  });
  const vocabulary = tenantVocabulary(tenant?.tenantType);
  const canAccessRules = canAccessRulesPage(hasAnyRole);
  const { upload, trashRetention, dirty, saving, save, discard } = useOrganizationSettings({
    governs,
    vocabulary,
  });

  const canEdit = upload.canManage || governs;

  return (
    <div className="settings-blocks">
      <section className="settings-block">
        <SettingsSectionHeader
          title={t('organizationSection.envioEIa')}
          description={`Vale para ${vocabulary.wholeScope}: quando a IA renomeia o arquivo e quando o envio para para revisão.`}
          className="settings-block__header"
        />
        <UploadAiSettingsSection
          draft={upload.draft}
          onChange={upload.setDraft}
          canManage={upload.canManage}
          dirty={upload.dirty}
        />
      </section>

      {/* Leitura para todo mundo, não só para quem governa: a mesma régua já vive no pé da
          barra lateral, e esconder aqui o número que a pessoa vê a navegação inteira seria
          esconder por engano. Não há o que administrar — a cota vem do servidor. */}
      <section className="settings-block">
        <SettingsSectionHeader
          title={t('organizationSection.armazenamento')}
          description={`O que os documentos ${vocabulary.ofScope} já ocupam.`}
          className="settings-block__header"
        />
        <StorageUsageSection />
      </section>

      {governs ? (
        <section className="settings-block">
          <SettingsSectionHeader
            title={t('organizationSection.retencaoDaLixeira')}
            description={t('organizationSection.porQuantoTempoUm')}
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
            title={t('organizationSection.governanca')}
            description={t('organizationSection.ondeAClassificacaoOs')}
            className="settings-block__header"
          />
          {/* O atalho para Usuários só existe para quem consegue abrir a tela. `/users` exige
              `company_admin` (UserManagementRoute), então em PF ele mandava a pessoa para uma
              rota que a devolvia calada para a Biblioteca — pior que não oferecer nada. */}
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
              ...(isCompanyAdmin
                ? [
                    {
                      icon: 'group',
                      title: 'Grupos de acesso',
                      description:
                        'Grupos vinculados às regras de visibilidade e permissões por área.',
                      href: '/users',
                      linkLabel: 'Gerenciar usuários',
                    },
                  ]
                : []),
            ]}
          />

          <aside className="settings-callout" role="note">
            <span className="settings-callout__icon" aria-hidden>
              <Icon name="info" size={18} />
            </span>
            <p className="settings-callout__body">
              {t('organizationSection.alteracoesEm')}{' '}
              <strong className="font-medium text-doqyn-text">
                {t('organizationSection.regras')}
              </strong>{' '}
              {t('organizationSection.impactamClassificacaoAutomaticaAlertas')}
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
