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
 * Uma camada acima do host que realmente contém a âncora.
 *
 * O valor fixo `--z-popover` (96) só resolvia o caso do modal (95). O diálogo de
 * confirmação nasce em `--z-confirm` (100) e o tour em `--z-tour` (110): um popover
 * aberto dentro deles voltaria a nascer por baixo. Lendo o z-index computado do
 * host, cada overlay ganha seu próprio teto — e a conta continua certa quando
 * alguém acrescentar uma camada nova na escala.
 *
 * Aninhamento resolve sozinho: `closest` para no host mais interno, então um
 * popover dentro de um confirm sobre uma gaveta ancora em 100, não em 85.
 */
function resolveOverlayHostLayer(host: HTMLElement): string {
  if (typeof window === 'undefined') return 'var(--z-popover)';
  const computed = Number.parseInt(window.getComputedStyle(host).zIndex, 10);
  return Number.isFinite(computed) ? String(computed + 1) : 'var(--z-popover)';
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
