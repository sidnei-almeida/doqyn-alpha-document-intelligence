import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionBody } from '../SettingsSectionBody';

type UploadAiSettingsSectionProps = {
  draft: WorkflowReviewSettings;
  onChange: (settings: WorkflowReviewSettings) => void;
  canManage: boolean;
  dirty: boolean;
};

/** Bloco de leitura/edição. Quem salva é a barra da tela — aqui não há botão. */
export function UploadAiSettingsSection({
  draft,
  onChange,
  canManage,
  dirty,
}: UploadAiSettingsSectionProps) {
  return (
    <SettingsSectionBody id="upload">
      {canManage ? null : (
        <p className="settings-section-note">
          Quem define esta política é o administrador da organização. Ela decide quando a IA
          renomeia o seu arquivo e quando o envio para para revisão.
        </p>
      )}

      <div className="settings-summary-bar" role="status" aria-live="polite">
        <div className="settings-summary-bar__label">
          <Icon name="tune" size={14} aria-hidden />
          <span>{canManage ? `Resumo ${dirty ? 'do rascunho' : 'atual'}` : 'Em vigor'}</span>
        </div>
        <div className="settings-summary-bar__values">
          <span className="settings-summary-bar__chip">
            {draft.autoReviewEnabled ? `Auto ${draft.autoAcceptDelaySeconds}s` : 'Revisão manual'}
          </span>
          <span className="settings-summary-bar__separator" aria-hidden>
            ·
          </span>
          <span className="settings-summary-bar__chip">
            {NAMING_POLICY_LABELS[draft.defaultNamingPolicy]}
          </span>
        </div>
      </div>

      <ReviewWorkflowSettingsPanel
        settings={draft}
        onChange={onChange}
        disabled={!canManage}
        variant="inline"
      />
    </SettingsSectionBody>
  );
}
