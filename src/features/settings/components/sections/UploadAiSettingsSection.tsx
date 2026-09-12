import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('settings');

  return (
    <SettingsSectionBody id="upload">
      {canManage ? null : (
        <p className="settings-section-note">
          {t('uploadAiSettingsSection.quemDefineEstaPolitica')}
        </p>
      )}

      <div className="settings-summary-bar" role="status" aria-live="polite">
        <div className="settings-summary-bar__label">
          <Icon name="tune" size={14} aria-hidden />
          <span>
            {canManage
              ? dirty
                ? t('uploadAiSettingsSection.summaryDraft')
                : t('uploadAiSettingsSection.summaryCurrent')
              : t('uploadAiSettingsSection.inEffect')}
          </span>
        </div>
        <div className="settings-summary-bar__values">
          <span className="settings-summary-bar__chip">
            {draft.autoReviewEnabled
              ? t('uploadAiSettingsSection.autoDelay', { seconds: draft.autoAcceptDelaySeconds })
              : t('uploadAiSettingsSection.manualReview')}
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
