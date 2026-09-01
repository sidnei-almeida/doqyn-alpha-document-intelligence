/**
 * Hosts de overlay (modal/drawer) — popovers ancorados dentro deles precisam de camada superior.
 *
 * `aria-modal` sozinho não alcançava a gaveta. `WorkspaceSideDrawer` é
 * `role="presentation"`, e pendurar `aria-modal` num `presentation` seria ARIA
 * inválido. Sem casar o seletor, o calendário do `DateField` aberto dentro da
 * gaveta de metadados caía no `--z-dropdown` (60) e nascia atrás do painel
 * (`--z-drawer` 85, `--z-modal` 95): abria e ficava invisível. `data-overlay-host`
 * marca a raiz do overlay sem tocar na semântica.
 */
export const OVERLAY_HOST_SELECTOR = '[aria-modal="true"],[data-overlay-host]';

export function isInsideOverlayHost(element: HTMLElement | null): boolean {
  return Boolean(element?.closest(OVERLAY_HOST_SELECTOR));
}

/**
 * Uma camada acima do elemento que de fato empilha o overlay.
 *
 * O valor fixo `--z-popover` (96) só resolvia o caso do modal (95). O diálogo de
 * confirmação nasce em `--z-confirm` (100) e o tour em `--z-tour` (110): um popover
 * aberto dentro deles voltaria a nascer por baixo. Lendo o z-index computado, cada
 * overlay ganha seu próprio teto — e a conta continua certa quando alguém
 * acrescentar uma camada nova na escala.
 *
 * A subida por ancestrais não é zelo: o marcador nem sempre está no elemento que
 * empilha. Em `Modal`, `aria-modal` fica no painel interno, que é filho flex sem
 * z-index — quem carrega a camada é o scrim, um nível acima. Parar no host leria
 * `auto` e cairia no fixo de novo, deixando o caso do confirm exatamente como
 * estava. Na gaveta o marcador está no próprio scrim, e o laço acerta na primeira
 * volta.
 *
 * Aninhamento resolve sozinho: `closest` para no host mais interno, então um
 * popover dentro de um confirm sobre uma gaveta ancora em 100, não em 85.
 */
function resolveOverlayHostLayer(host: HTMLElement): string {
  if (typeof window === 'undefined') return 'var(--z-popover)';
  for (let node: HTMLElement | null = host; node && node !== document.body; ) {
    const computed = Number.parseInt(window.getComputedStyle(node).zIndex, 10);
    if (Number.isFinite(computed)) return String(computed + 1);
    node = node.parentElement;
  }
  return 'var(--z-popover)';
}

export function resolvePopoverZIndex(
  anchor: HTMLElement | null,
  fallback: string,
  explicit?: string,
): string {
  if (explicit) return explicit;
  const host = anchor?.closest<HTMLElement>(OVERLAY_HOST_SELECTOR) ?? null;
  if (host) return resolveOverlayHostLayer(host);
  return fallback;
}
