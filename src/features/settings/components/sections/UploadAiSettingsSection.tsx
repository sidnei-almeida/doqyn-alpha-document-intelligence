import { useEffect, useMemo, useState } from 'react';
import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { useUploadPolicy } from '@/features/settings/hooks/useUploadPolicy';
import { Icon } from '@/components/ui/Icon';
import { showAppToast } from '@/shared/feedback/appFeedback';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsSaveBar } from '../SettingsSaveBar';

function settingsSignature(settings: WorkflowReviewSettings): string {
  return JSON.stringify(settings);
}

export function UploadAiSettingsSection() {
  const { policy, canManage, isSaving, savePolicy } = useUploadPolicy();
  const [draft, setDraft] = useState<WorkflowReviewSettings>(policy);

  useEffect(() => {
    setDraft(policy);
  }, [policy]);

  const isDirty = useMemo(
    () => canManage && settingsSignature(draft) !== settingsSignature(policy),
    [canManage, draft, policy],
  );

  const handleSave = async () => {
    try {
      await savePolicy(draft);
      showAppToast({
        type: 'success',
        title: 'Política salva',
        message: 'Upload e IA passam a valer para toda a organização.',
      });
    } catch (error) {
      showAppToast({
        type: 'error',
        title: 'Não foi possível salvar',
        message: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const handleDiscard = () => {
    setDraft(policy);
  };

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
          <span>{canManage ? `Resumo ${isDirty ? 'do rascunho' : 'atual'}` : 'Em vigor'}</span>
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
        onChange={setDraft}
        disabled={!canManage}
        variant="inline"
      />

      {canManage ? (
        <SettingsSaveBar
          dirty={isDirty}
          saving={isSaving}
          onSave={() => void handleSave()}
          onDiscard={handleDiscard}
        />
      ) : null}
    </SettingsSectionBody>
  );
}
