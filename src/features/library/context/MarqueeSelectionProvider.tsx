import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { MarqueeSelectionOverlay } from '../components/MarqueeSelectionOverlay';
import {
  collectSelectableItemsFromContainer,
  clientPointToLocal,
  exceedsDragThreshold,
  findIntersectingSelectableIds,
  findScrollableAncestor,
  isMarqueePointerType,
  localRectToClient,
  mergeMarqueeSelection,
  normalizeSelectionRect,
  shouldBlockMarqueeStart,
  type Point,
  type SelectionRect,
} from '../utils/marqueeSelectionUtils';

const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_STEP_PX = 10;

type MarqueeSelectionProviderProps = {
  children: ReactNode;
  enabled?: boolean;
  onApplySelection: (fileIds: string[], folderIds: string[], additive: boolean) => void;
  onRestoreSelection: (fileIds: string[], folderIds: string[]) => void;
  captureSelectionSnapshot: () => { fileIds: string[]; folderIds: string[] };
  onDragStateChange?: (isDragging: boolean) => void;
};

type DragState = {
  pointerId: number;
  start: Point;
  current: Point;
  additive: boolean;
  snapshot: { fileIds: Set<string>; folderIds: Set<string> };
};

export function MarqueeSelectionProvider({
  children,
  enabled = true,
  onApplySelection,
  onRestoreSelection,
  captureSelectionSnapshot,
  onDragStateChange,
}: MarqueeSelectionProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  /** Evita que o click pós-pointerup limpe a seleção recém-aplicada pelo marquee. */
  const suppressClickRef = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<SelectionRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyIntersected = useCallback(
    (rect: SelectionRect, drag: DragState) => {
      const container = containerRef.current;
      if (!container) return;

      const items = collectSelectableItemsFromContainer(container);
      const clientRect = localRectToClient(rect, container);
      const intersected = findIntersectingSelectableIds(clientRect, items);
      const merged = mergeMarqueeSelection(drag.snapshot, intersected, drag.additive);
      onApplySelection(merged.fileIds, merged.folderIds, false);
    },
    [onApplySelection],
  );

  const finishDrag = useCallback(() => {
    const committedMarquee = isDraggingRef.current;
    const container = containerRef.current;
    const drag = dragRef.current;
    if (container && drag) {
      try {
        container.releasePointerCapture(drag.pointerId);
      } catch {
        // pointer capture may not be set when drag never passed threshold
      }
    }

    if (committedMarquee) {
      suppressClickRef.current = true;
    }

    dragRef.current = null;
    isDraggingRef.current = false;
    setMarqueeRect(null);
    setIsDragging(false);
    onDragStateChange?.(false);
  }, [onDragStateChange]);

  const cancelDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    onRestoreSelection([...drag.snapshot.fileIds], [...drag.snapshot.folderIds]);
    finishDrag();
  }, [finishDrag, onRestoreSelection]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container || event.pointerId !== drag.pointerId) return;

      const current = clientPointToLocal(event.clientX, event.clientY, container);

      if (!isDraggingRef.current) {
        if (!exceedsDragThreshold(drag.start, current)) return;
        isDraggingRef.current = true;
        setIsDragging(true);
        onDragStateChange?.(true);
        try {
          container.setPointerCapture(drag.pointerId);
        } catch {
          // ignore capture failures
        }
      }

      drag.current = current;
      const rect = normalizeSelectionRect(drag.start, current);
      setMarqueeRect(rect);
      applyIntersected(rect, drag);

      const scrollTarget =
        findScrollableAncestor(
          document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null,
          container,
        ) ?? container;

      const bounds = scrollTarget.getBoundingClientRect();
      if (event.clientY > bounds.bottom - AUTO_SCROLL_EDGE_PX) {
        scrollTarget.scrollTop += AUTO_SCROLL_STEP_PX;
      } else if (event.clientY < bounds.top + AUTO_SCROLL_EDGE_PX) {
        scrollTarget.scrollTop -= AUTO_SCROLL_STEP_PX;
      }
    },
    [applyIntersected, onDragStateChange],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (isDraggingRef.current) {
        const rect = normalizeSelectionRect(drag.start, drag.current);
        applyIntersected(rect, drag);
      }

      finishDrag();
    },
    [applyIntersected, finishDrag],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [enabled, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      cancelDrag();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelDrag, enabled]);

  const handleClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!enabled || event.button !== 0 || !container) return;
      if (!isMarqueePointerType(event.pointerType)) return;
      if (shouldBlockMarqueeStart(event.target)) return;

      const localPoint = clientPointToLocal(event.clientX, event.clientY, container);
      const snapshotRaw = captureSelectionSnapshot();
      dragRef.current = {
        pointerId: event.pointerId,
        start: localPoint,
        current: localPoint,
        additive: event.metaKey || event.ctrlKey,
        snapshot: {
          fileIds: new Set(snapshotRaw.fileIds),
          folderIds: new Set(snapshotRaw.folderIds),
        },
      };
    },
    [captureSelectionSnapshot, enabled],
  );

  return (
    <div
      ref={containerRef}
      className="marquee-selection-surface relative flex min-h-full min-h-0 w-full flex-1 flex-col"
      data-testid="marquee-selection-surface"
      onPointerDownCapture={handlePointerDown}
      onClickCapture={handleClickCapture}
    >
      {children}
      <MarqueeSelectionOverlay rect={marqueeRect} visible={isDragging} />
    </div>
  );
}
