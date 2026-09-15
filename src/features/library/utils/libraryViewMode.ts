import type { LibraryViewMode } from '../types/library';

/**
 * O modo de visualização como estado que se percorre, não como par de opções.
 *
 * Espelha `lib/theme.ts`: nome, glifo e qual vem no próximo clique ficam juntos, num lugar
 * só, para que o botão do cabeçalho e o menu de contexto nunca discordem sobre como se
 * chama cada vista.
 */

export const VIEW_MODE_ORDER: readonly LibraryViewMode[] = ['grid', 'list'];

/** Chaves do namespace `library`; a tela traduz. */
export const VIEW_MODE_LABEL_KEYS: Record<LibraryViewMode, string> = {
  grid: 'viewMode.grid',
  list: 'viewMode.list',
};

/** Como a vista se chama no meio de uma frase — "Clique para lista." */
export const VIEW_MODE_SHORT_KEYS: Record<LibraryViewMode, string> = {
  grid: 'viewMode.shortGrid',
  list: 'viewMode.shortList',
};

export const VIEW_MODE_ICONS: Record<LibraryViewMode, string> = {
  grid: 'grid_view',
  list: 'view_list',
};

export function nextViewMode(mode: LibraryViewMode): LibraryViewMode {
  const index = VIEW_MODE_ORDER.indexOf(mode);
  return VIEW_MODE_ORDER[(index + 1) % VIEW_MODE_ORDER.length];
}
