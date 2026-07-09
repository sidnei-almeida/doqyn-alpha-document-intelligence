/** Hosts de overlay (modal/drawer) — popovers ancorados dentro deles precisam de camada superior. */
export const OVERLAY_HOST_SELECTOR = '[aria-modal="true"]';

export function isInsideOverlayHost(element: HTMLElement | null): boolean {
  return Boolean(element?.closest(OVERLAY_HOST_SELECTOR));
}

export function resolvePopoverZIndex(
  anchor: HTMLElement | null,
  fallback: string,
  explicit?: string,
): string {
  if (explicit) return explicit;
  if (isInsideOverlayHost(anchor)) return 'var(--z-popover)';
  return fallback;
}
