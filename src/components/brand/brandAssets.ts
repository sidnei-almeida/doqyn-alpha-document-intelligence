/** Assets de marca em /public/brand */
export const BRAND_ASSETS = {
  mark: '/brand/doqyn-mark.webp',
  horizontal: '/brand/doqyn-horizontal.webp',
  vertical: '/brand/doqyn-vertical.webp',
  wordmark: '/brand/doqyn-wordmark.webp',
  /** Logo clara — exibida no tema escuro */
  sidebarForDarkTheme: '/brand/doqyn-sidebar-light.png',
  /** Logo escura — exibida no tema claro */
  sidebarForLightTheme: '/brand/doqyn-sidebar-dark.png',
  /** Ícone (sem wordmark) — sidebar recolhida */
  sidebarIcon: '/brand/doqyn-sidebar-icon.png',
} as const;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;
