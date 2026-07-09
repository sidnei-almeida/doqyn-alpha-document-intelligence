import { useEffect } from 'react';

type UseExplorerSelectionShortcutsOptions = {
  onClearSelection: () => void;
  /** Quando true, ESC não limpa (ex.: menu de contexto aberto). */
  blockClear?: boolean;
};

/** ESC limpa seleção; integração com clique em área vazia fica no dropzone. */
export function useExplorerSelectionShortcuts({
  onClearSelection,
  blockClear = false,
}: UseExplorerSelectionShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || blockClear) return;
      onClearSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blockClear, onClearSelection]);
}
