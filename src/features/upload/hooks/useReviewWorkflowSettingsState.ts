import { useCallback, useEffect, useState } from 'react';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import {
  loadReviewWorkflowSettings,
  saveReviewWorkflowSettings,
} from '@/features/document-send/utils/reviewWorkflowSettings';

/** Preferências de upload/revisão — persistidas em localStorage, compartilhadas com o fluxo legado. */
export function useReviewWorkflowSettingsState() {
  const [settings, setSettingsState] = useState<WorkflowReviewSettings>(() =>
    loadReviewWorkflowSettings(),
  );

  const setSettings = useCallback((next: WorkflowReviewSettings) => {
    const saved = { ...next };
    saveReviewWorkflowSettings(saved);
    setSettingsState(saved);
  }, []);

  const patchSettings = useCallback(
    (partial: Partial<WorkflowReviewSettings>) => {
      setSettings({ ...settings, ...partial });
    },
    [settings, setSettings],
  );

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.includes('doqyn.upload')) {
        setSettingsState(loadReviewWorkflowSettings());
      }
    };
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  return { settings, setSettings, patchSettings, reloadSettings: () => setSettingsState(loadReviewWorkflowSettings()) };
}
