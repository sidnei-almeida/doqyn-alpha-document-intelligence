import { cn } from '@/lib/utils';
import type { SelectionRect } from '../utils/marqueeSelectionUtils';

type MarqueeSelectionOverlayProps = {
  rect: SelectionRect | null;
  visible: boolean;
};

export function MarqueeSelectionOverlay({ rect, visible }: MarqueeSelectionOverlayProps) {
  if (!visible || !rect || rect.width < 1 || rect.height < 1) return null;

  return (
    <div
      className={cn('explorer-marquee-selection pointer-events-none absolute z-[var(--z-sticky)]')}
      data-testid="explorer-marquee-selection"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
      aria-hidden
    />
  );
}
