import { i18n } from '@/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTrashRetentionSettings } from '@/features/library/hooks/useTrashMutations';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { showAppToast } from '@/shared/feedback/appFeedback';
import type { TenantVocabulary } from '@/lib/tenantVocabulary';
import { useUploadPolicy } from './useUploadPolicy';

export type RetentionDraft = {
  mode: 'days' | 'manual';
  days: number;
};

function signature(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Rascunho da tela inteira de Organização. A regra de salvamento é uma só: nada vale
 * até confirmar, e uma barra no fim da coluna salva os blocos que mudaram.
 */
export function useOrganizationSettings({
  governs,
  vocabulary,
}: {
  governs: boolean;
  vocabulary: TenantVocabulary;
}) {
  const uploadPolicy = useUploadPolicy();
  const [uploadDraft, setUploadDraft] = useState<WorkflowReviewSettings>(uploadPolicy.policy);
  useEffect(() => {
    setUploadDraft(uploadPolicy.policy);
  }, [uploadPolicy.policy]);

  const retention = useTrashRetentionSettings();
  const retentionSettings = retention.data;
  const [retentionDraft, setRetentionDraft] = useState<RetentionDraft>({
    mode: 'days',
    days: 30,
  });
  useEffect(() => {
    if (!retentionSettings) return;
    setRetentionDraft({
      mode: retentionSettings.trashRetentionMode,
      days: retentionSettings.trashRetentionDays,
    });
  }, [retentionSettings]);

  const uploadDirty =
    uploadPolicy.canManage && signature(uploadDraft) !== signature(uploadPolicy.policy);

  const retentionDirty =
    governs &&
    Boolean(retentionSettings) &&
    (retentionDraft.mode !== retentionSettings?.trashRetentionMode ||
      retentionDraft.days !== retentionSettings?.trashRetentionDays);

  const [saving, setSaving] = useState(false);

  const dirty = uploadDirty || retentionDirty;

  const discard = useCallback(() => {
    setUploadDraft(uploadPolicy.policy);
    if (retentionSettings) {
      setRetentionDraft({
        mode: retentionSettings.trashRetentionMode,
        days: retentionSettings.trashRetentionDays,
      });
    }
  }, [retentionSettings, uploadPolicy.policy]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;

    setSaving(true);
    try {
      if (uploadDirty) {
        await uploadPolicy.savePolicy(uploadDraft);
      }
      if (retentionDirty) {
        await retention.updateSettingsAsync({
          trashRetentionMode: retentionDraft.mode,
          trashRetentionDays: retentionDraft.days,
        });
      }
      showAppToast({
        type: 'success',
        title: i18n.t('settings:toast.salvo'),
        message: i18n.t(`settings:toast.salvoMessage.${vocabulary.variant}`),
      });
    } catch (error) {
      showAppToast({
        type: 'error',
        title: i18n.t('settings:toast.falhaSalvar'),
        message:
          error instanceof Error ? error.message : i18n.t('settings:toast.falhaSalvarMessage'),
      });
    } finally {
      setSaving(false);
    }
  }, [
    dirty,
    retention,
    retentionDirty,
    retentionDraft,
    saving,
    uploadDirty,
    uploadDraft,
    uploadPolicy,
    vocabulary,
  ]);

  const upload = useMemo(
    () => ({
      draft: uploadDraft,
      setDraft: setUploadDraft,
      canManage: uploadPolicy.canManage,
      isLoading: uploadPolicy.isLoading,
      dirty: uploadDirty,
    }),
    [uploadDirty, uploadDraft, uploadPolicy.canManage, uploadPolicy.isLoading],
  );

  const trashRetention = useMemo(
    () => ({
      draft: retentionDraft,
      setDraft: setRetentionDraft,
      isLoading: retention.isLoading,
    }),
    [retention.isLoading, retentionDraft],
  );

  return { upload, trashRetention, dirty, saving, save, discard };
}
