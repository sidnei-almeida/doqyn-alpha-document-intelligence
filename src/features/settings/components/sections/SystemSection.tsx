import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { SecurityFactsBlock } from './SecurityFactsBlock';
import { SystemSettingsSection } from './SystemSettingsSection';

/** Sistema é leitura: o que a plataforma informa sobre si, incluindo o que já protege. */
export function SystemSection() {
  return (
    <div className="settings-blocks">
      <section className="settings-block">
        <SettingsSectionHeader
          title="Plataforma"
          description="Identidade, ambiente e infraestrutura em uso."
          className="settings-block__header"
        />
        <SystemSettingsSection />
      </section>

      <section className="settings-block">
        <SettingsSectionHeader
          title="Segurança"
          description="O que já é registrado e protegido, sem configuração necessária."
          className="settings-block__header"
        />
        <SecurityFactsBlock />
      </section>
    </div>
  );
}
