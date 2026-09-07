import type { LibraryViewMode } from '../types/library';

/**
 * O modo de visualização como estado que se percorre, não como par de opções.
 *
 * Espelha `lib/theme.ts`: nome, glifo e qual vem no próximo clique ficam juntos, num lugar
 * só, para que o botão do cabeçalho e o menu de contexto nunca discordem sobre como se
 * chama cada vista.
 */

export const VIEW_MODE_ORDER: readonly LibraryViewMode[] = ['grid', 'list'];

export const VIEW_MODE_LABELS: Record<LibraryViewMode, string> = {
  grid: 'Visualização em grade',
  list: 'Visualização em lista',
};

/** Como a vista se chama no meio de uma frase — "Clique para lista." */
export const VIEW_MODE_SHORT_LABELS: Record<LibraryViewMode, string> = {
  grid: 'grade',
  list: 'lista',
};

export const VIEW_MODE_ICONS: Record<LibraryViewMode, string> = {
  grid: 'grid_view',
  list: 'view_list',
};

export function nextViewMode(mode: LibraryViewMode): LibraryViewMode {
  const index = VIEW_MODE_ORDER.indexOf(mode);
  return VIEW_MODE_ORDER[(index + 1) % VIEW_MODE_ORDER.length];
}
