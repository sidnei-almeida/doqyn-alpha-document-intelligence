export type Theme = 'standard' | 'light' | 'dark';

/** Mesma chave do doqyn-internal para consistência de preferência visual */
export const THEME_STORAGE_KEY = 'doqyn-theme';

export const THEMES: Theme[] = ['standard', 'light', 'dark'];

/**
 * Rótulo e descrição saíram daqui para o catálogo, e ficaram as **chaves**.
 *
 * "Padrão", "Claro" e "Escuro" são texto de tela: aparecem no seletor de Configurações e no
 * tooltip do alternador. O que sobra neste módulo é o que não se traduz — a lista de temas, o
 * ícone de cada um, e qual paleta cada um resolve.
 */
export const THEME_LABEL_KEYS: Record<Theme, string> = {
  standard: 'components:theme.standardLabel',
  light: 'components:theme.lightLabel',
  dark: 'components:theme.darkLabel',
};

export const THEME_HINT_KEYS: Record<Theme, string> = {
  standard: 'components:theme.standardHint',
  light: 'components:theme.lightHint',
  dark: 'components:theme.darkHint',
};

export const THEME_ICONS: Record<Theme, string> = {
  standard: 'contrast',
  light: 'light_mode',
  dark: 'dark_mode',
};

/**
 * A casca e o painel são camadas independentes, e é isso que o tema precisa
 * dizer. `data-appearance` nomeia o tema; `data-theme` diz qual paleta vale por
 * padrão — que é a do *painel*, porque é onde mora quase tudo. No `standard` a
 * casca desmente esse padrão localmente, via a classe `chrome-dark`.
 *
 * Dois atributos em vez de um porque `standard` é uma mistura: painel de papel
 * com casca de grafite. Com um atributo só, ou a casca ou o conteúdo teria de
 * carregar a paleta errada e ser corrigido peça por peça.
 */
const CANVAS_PALETTE: Record<Theme, 'light' | 'dark'> = {
  standard: 'light',
  light: 'light',
  dark: 'dark',
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as string[]).includes(value);
}

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

/**
 * O primeiro tema é sempre o `standard`, e não o que o sistema operacional prefere.
 *
 * O DOQYN tem uma aparência própria — casca de grafite, painel de papel — e é ela que
 * apresenta o produto a quem chega. Herdar `prefers-color-scheme` fazia quem usa o sistema no
 * escuro abrir direto no terceiro tema da lista, sem nunca ter escolhido nenhum. A partir da
 * primeira escolha vale o que a pessoa escolheu, que é o que `getStoredTheme` guarda.
 */
export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? 'standard';
}

export function nextTheme(current: Theme): Theme {
  const index = THEMES.indexOf(current);
  return THEMES[(index + 1) % THEMES.length];
}

export function applyTheme(theme: Theme) {
  const palette = CANVAS_PALETTE[theme];
  document.documentElement.dataset.appearance = theme;
  document.documentElement.dataset.theme = palette;
  document.documentElement.style.colorScheme = palette;
}
