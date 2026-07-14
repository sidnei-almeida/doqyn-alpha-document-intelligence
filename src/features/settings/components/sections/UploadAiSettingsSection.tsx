import { useEffect, useMemo, useState } from 'react';
import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import {
  NAMING_POLICY_LABELS,
} from '@/features/document-send/utils/reviewWorkflowSettings';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import { Icon } from '@/components/ui/Icon';
import { showAppToast } from '@/shared/feedback/appFeedback';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsSaveBar } from '../SettingsSaveBar';

function settingsSignature(settings: WorkflowReviewSettings): string {
  return JSON.stringify(settings);
}

export function UploadAiSettingsSection() {
  const { reviewSettings, updateReviewSettings } = useUploadQueueContext();
  const [draft, setDraft] = useState<WorkflowReviewSettings>(reviewSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(reviewSettings);
  }, [reviewSettings]);

  const isDirty = useMemo(
    () => settingsSignature(draft) !== settingsSignature(reviewSettings),
    [draft, reviewSettings],
  );

  const handleSave = () => {
    setSaving(true);
    try {
      updateReviewSettings(draft);
      showAppToast({
        type: 'success',
        title: 'Configurações salvas',
        message: 'Preferências de Upload e IA aplicadas neste navegador.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(reviewSettings);
  };

  return (
    <SettingsSectionBody id="upload">
      <p className="settings-section-note">
        Ajuste as preferências abaixo e use Salvar para aplicá-las neste navegador (Biblioteca, fila
        de upload e fluxo de envio).
      </p>

      <div className="settings-summary-bar" role="status" aria-live="polite">
        <div className="settings-summary-bar__label">
          <Icon name="tune" size={14} aria-hidden />
          <span>Resumo {isDirty ? 'do rascunho' : 'atual'}</span>
        </div>
        <div className="settings-summary-bar__values">
          <span className="settings-summary-bar__chip">
            {draft.autoReviewEnabled
              ? `Auto ${draft.autoAcceptDelaySeconds}s`
              : 'Revisão manual'}
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
        onChange={setDraft}
        variant="inline"
      />

      <SettingsSaveBar
        dirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </SettingsSectionBody>
  );
}
