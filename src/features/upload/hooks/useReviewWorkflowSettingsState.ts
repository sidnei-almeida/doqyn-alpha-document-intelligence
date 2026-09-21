import { useCallback } from 'react';
import { toast } from 'sonner';
import { i18n } from '@/i18n';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import { useUploadPolicy } from '@/features/settings/hooks/useUploadPolicy';

/**
 * Política de upload/revisão em uso pela fila — vem do tenant, não do navegador.
 * Só quem governa a organização consegue gravar; para os demais, `canManage` é falso e a
 * escrita é rejeitada pelo servidor (403).
 */
export function useReviewWorkflowSettingsState() {
  const { policy, canManage, isLoading, isSaving, savePolicy, refetchPolicy } = useUploadPolicy();

  const setSettings = useCallback(
    (next: WorkflowReviewSettings) => {
      void savePolicy(next).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : i18n.t('upload:policySaveFailed');
        toast.error(message);
      });
    },
    [savePolicy],
  );

  const patchSettings = useCallback(
    (partial: Partial<WorkflowReviewSettings>) => {
      setSettings({ ...policy, ...partial });
    },
    [policy, setSettings],
  );

  return {
    settings: policy,
    canManage,
    isLoading,
    isSaving,
    setSettings,
    patchSettings,
    reloadSettings: () => {
      void refetchPolicy();
    },
  };
}
