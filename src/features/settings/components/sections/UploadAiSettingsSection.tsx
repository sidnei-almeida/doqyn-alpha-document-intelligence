import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import { Icon } from '@/components/ui/Icon';
import { SettingsSectionBody } from '../SettingsSectionBody';

export function UploadAiSettingsSection() {
  const { reviewSettings, updateReviewSettings } = useUploadQueueContext();

  return (
    <SettingsSectionBody id="upload">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="settings-section-note">
          Preferências salvas neste navegador e aplicadas à Biblioteca, fila de upload e fluxo
          legado.
        </p>
        <span className="settings-summary-pill">
          <Icon name="auto_awesome" size={14} aria-hidden />
          {reviewSettings.autoReviewEnabled
            ? `Auto ${reviewSettings.autoAcceptDelaySeconds}s`
            : 'Revisão manual'}
          <span className="text-doqyn-subtle" aria-hidden>
            ·
          </span>
          {NAMING_POLICY_LABELS[reviewSettings.defaultNamingPolicy]}
        </span>
      </div>

      <ReviewWorkflowSettingsPanel
        settings={reviewSettings}
        onChange={updateReviewSettings}
        variant="inline"
      />
    </SettingsSectionBody>
  );
}
