import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsInfoCard } from '../SettingsInfoCard';

export function SecuritySettingsSection() {
  return (
    <SettingsSectionBody>
      <div className="settings-cards-grid">
        <SettingsInfoCard
          icon="shield"
          title="Auditoria documental"
          description="Todas as ações relevantes — upload, preview, download, alterações e acessos negados — são registradas para investigação."
          status="ok"
          href="/tracking"
          linkLabel="Abrir tracking"
        />
        <SettingsInfoCard
          icon="history_toggle_off"
          title="Histórico de versões"
          description="Versões de documentos são preservadas no histórico da organização para rastreabilidade e conformidade."
          status="ok"
        />
        <SettingsInfoCard
          icon="visibility"
          title="Preview e visualização"
          description="Previews respeitam permissões do usuário. Visualizações podem ser registradas no tracking documental."
          status="ok"
          href="/tracking"
          linkLabel="Ver atividade"
        />
        <SettingsInfoCard
          icon="download"
          title="Downloads controlados"
          description="Downloads exigem permissão explícita. Tentativas negadas ficam registradas para auditoria."
          status="ok"
        />
        <SettingsInfoCard
          icon="verified_user"
          title="Dados sanitizados"
          description="Logs e tracking não armazenam conteúdo de documentos, OCR integral, tokens ou URLs de storage em texto bruto."
          status="ok"
          href="/audit"
          linkLabel="Auditoria geral"
        />
      </div>
    </SettingsSectionBody>
  );
}
