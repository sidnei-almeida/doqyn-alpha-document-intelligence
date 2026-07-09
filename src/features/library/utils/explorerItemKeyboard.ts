import type { KeyboardEvent } from 'react';

type ExplorerItemKeyboardOptions = {
  isSelected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
};

/** Atalhos de teclado estilo file explorer — Enter abre, Space alterna seleção. */
export function handleExplorerItemKeyDown(
  event: KeyboardEvent,
  { onOpen, onToggleSelect }: ExplorerItemKeyboardOptions,
): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    onOpen();
    return;
  }

  if (event.key === ' ') {
    event.preventDefault();
    onToggleSelect();
  }
}
