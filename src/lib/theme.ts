export type Theme = 'standard' | 'light' | 'dark';

/** Mesma chave do doqyn-internal para consistência de preferência visual */
export const THEME_STORAGE_KEY = 'doqyn-theme';

export const THEMES: Theme[] = ['standard', 'light', 'dark'];

export const THEME_LABELS: Record<Theme, string> = {
  standard: 'Padrão',
  light: 'Claro',
  dark: 'Escuro',
};

export const THEME_HINTS: Record<Theme, string> = {
  standard: 'Casca grafite, painel de papel',
  light: 'Casca cinza-clara, painel de papel',
  dark: 'Casca quase preta, painel grafite',
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

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'standard';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'standard';
}

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
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
