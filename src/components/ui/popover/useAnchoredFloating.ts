import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { resolvePopoverZIndex } from './popoverZIndex';

export type FloatingPlacement =
  | 'bottom-end'
  | 'bottom-start'
  | 'right-start'
  | 'top-start'
  | 'top-end'
  | 'left-start';

const GAP_PX = 6;
const VIEWPORT_PADDING = 8;

type MeasuredPanel = {
  width: number;
  height: number;
};

type VisualPosition = {
  top: number;
  left: number;
};

function getFallbackPanelSize(placement: FloatingPlacement): MeasuredPanel {
  if (placement === 'right-start' || placement === 'left-start') {
    return { width: 256, height: 280 };
  }
  return { width: 224, height: 320 };
}

/** Coordenadas visuais finais — sem transform, para clamp previsível. */
function computeVisualPosition(
  anchor: DOMRect,
  placement: FloatingPlacement,
  panel: MeasuredPanel,
): VisualPosition {
  switch (placement) {
    case 'bottom-end':
      return {
        top: anchor.bottom + GAP_PX,
        left: anchor.right - panel.width,
      };
    case 'bottom-start':
      return {
        top: anchor.bottom + GAP_PX,
        left: anchor.left,
      };
    case 'top-end':
      return {
        top: anchor.top - GAP_PX - panel.height,
        left: anchor.right - panel.width,
      };
    case 'top-start':
      return {
        top: anchor.top - GAP_PX - panel.height,
        left: anchor.left,
      };
    case 'right-start':
      return {
        top: anchor.top,
        left: anchor.right + GAP_PX,
      };
    case 'left-start':
      return {
        top: anchor.top,
        left: anchor.left - GAP_PX - panel.width,
      };
    default:
      return {
        top: anchor.bottom + GAP_PX,
        left: anchor.left,
      };
  }
}

function clampVisualPosition(position: VisualPosition, panel: MeasuredPanel): VisualPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = vw - VIEWPORT_PADDING - panel.width;
  const maxTop = vh - VIEWPORT_PADDING - panel.height;

  return {
    left: Math.min(Math.max(position.left, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, maxLeft)),
    top: Math.min(Math.max(position.top, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, maxTop)),
  };
}

function fitsViewport(position: VisualPosition, panel: MeasuredPanel): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    position.left >= VIEWPORT_PADDING &&
    position.top >= VIEWPORT_PADDING &&
    position.left + panel.width <= vw - VIEWPORT_PADDING &&
    position.top + panel.height <= vh - VIEWPORT_PADDING
  );
}

function placementCandidates(preferred: FloatingPlacement): FloatingPlacement[] {
  switch (preferred) {
    case 'bottom-end':
      return ['bottom-end', 'bottom-start', 'top-end', 'top-start'];
    case 'bottom-start':
      return ['bottom-start', 'bottom-end', 'top-start', 'top-end'];
    case 'top-start':
      return ['top-start', 'top-end', 'bottom-start', 'bottom-end'];
    case 'top-end':
      return ['top-end', 'top-start', 'bottom-end', 'bottom-start'];
    case 'right-start':
      return ['right-start', 'left-start', 'bottom-end', 'top-end'];
    default:
      return [preferred];
  }
}

function resolveFloatingPosition(
  anchor: DOMRect,
  panel: MeasuredPanel,
  preferred: FloatingPlacement,
): VisualPosition {
  for (const placement of placementCandidates(preferred)) {
    const candidate = clampVisualPosition(computeVisualPosition(anchor, placement, panel), panel);
    if (fitsViewport(candidate, panel)) return candidate;
  }

  return clampVisualPosition(computeVisualPosition(anchor, preferred, panel), panel);
}

function measurePanel(
  panelEl: HTMLElement | null,
  placement: FloatingPlacement,
): MeasuredPanel {
  if (!panelEl) return getFallbackPanelSize(placement);
  const rect = panelEl.getBoundingClientRect();
  const fallback = getFallbackPanelSize(placement);
  return {
    width: rect.width > 0 ? rect.width : fallback.width,
    height: rect.height > 0 ? rect.height : fallback.height,
  };
}

function zIndexForPlacement(placement: FloatingPlacement): string {
  if (placement === 'right-start' || placement === 'left-start') {
    return 'var(--z-sidebar-flyout)';
  }
  return 'var(--z-dropdown)';
}

/** Posiciona painéis flutuantes com fixed + portal, flip/clamp na viewport. */
export function useAnchoredFloating(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  placement: FloatingPlacement,
  zIndex?: string,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle({ visibility: 'hidden' });
      return;
    }

    const update = () => {
      if (!anchorRef.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const panel = measurePanel(panelRef.current, placement);
      const resolved = resolveFloatingPosition(anchor, panel, placement);
      const vh = window.innerHeight;

      setStyle({
        position: 'fixed',
        top: resolved.top,
        left: resolved.left,
        zIndex: resolvePopoverZIndex(anchorRef.current, zIndexForPlacement(placement), zIndex),
        visibility: 'visible',
        maxHeight: `min(24rem, calc(${vh}px - ${VIEWPORT_PADDING * 2}px))`,
        overflowY: 'auto',
      });
    };

    update();
    const frame = requestAnimationFrame(update);

    const resizeObserver =
      panelRef.current && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(update)
        : null;
    resizeObserver?.observe(panelRef.current!);

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, panelRef, open, placement, zIndex]);

  return style;
}
