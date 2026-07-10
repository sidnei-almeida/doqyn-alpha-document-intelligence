import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionBody } from '../SettingsSectionBody';

export function UploadAiSettingsSection() {
  const { reviewSettings, updateReviewSettings } = useUploadQueueContext();

  return (
    <SettingsSectionBody id="upload">
      <p className="settings-section-note">
        Preferências salvas neste navegador e aplicadas à Biblioteca, fila de upload e fluxo legado.
      </p>

      <div className="settings-summary-bar" role="status" aria-live="polite">
        <div className="settings-summary-bar__label">
          <Icon name="tune" size={14} aria-hidden />
          <span>Resumo atual</span>
        </div>
        <div className="settings-summary-bar__values">
          <span className="settings-summary-bar__chip">
            {reviewSettings.autoReviewEnabled
              ? `Auto ${reviewSettings.autoAcceptDelaySeconds}s`
              : 'Revisão manual'}
          </span>
          <span className="settings-summary-bar__separator" aria-hidden>
            ·
          </span>
          <span className="settings-summary-bar__chip">
            {NAMING_POLICY_LABELS[reviewSettings.defaultNamingPolicy]}
          </span>
        </div>
      </div>

      <ReviewWorkflowSettingsPanel
        settings={reviewSettings}
        onChange={updateReviewSettings}
        variant="inline"
      />
    </SettingsSectionBody>
  );
}
