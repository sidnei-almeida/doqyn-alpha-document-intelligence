import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsInfoCard } from '../SettingsInfoCard';

export function OrganizationSettingsSection() {
  return (
    <SettingsSectionBody>
      <div className="settings-cards-grid">
        <SettingsInfoCard
          icon="balance"
          title="Regras e governança"
          description="Defina políticas de classificação, fluxos de aprovação e mapeamento entre categorias e grupos."
          status="ok"
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

      <SettingsCard>
        <p className="text-sm text-doqyn-muted">
          A governança documental é configurada em <strong className="font-medium text-doqyn-text">Regras</strong>.
          Alterações impactam classificação automática, alertas e permissões na Biblioteca.
        </p>
      </SettingsCard>
    </SettingsSectionBody>
  );
}
