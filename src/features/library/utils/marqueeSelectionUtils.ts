export const MARQUEE_DRAG_THRESHOLD_PX = 6;

export type Point = { x: number; y: number };

export type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Converte ponto do viewport para coordenadas locais do container (overlay absolute). */
export function clientPointToLocal(
  clientX: number,
  clientY: number,
  container: Pick<HTMLElement, 'getBoundingClientRect' | 'scrollLeft' | 'scrollTop'>,
): Point {
  const bounds = container.getBoundingClientRect();
  return {
    x: clientX - bounds.left + container.scrollLeft,
    y: clientY - bounds.top + container.scrollTop,
  };
}

/** Converte retângulo local do container para coordenadas do viewport (hit test). */
export function localRectToClient(
  rect: SelectionRect,
  container: Pick<HTMLElement, 'getBoundingClientRect' | 'scrollLeft' | 'scrollTop'>,
): SelectionRect {
  const bounds = container.getBoundingClientRect();
  return {
    left: rect.left + bounds.left - container.scrollLeft,
    top: rect.top + bounds.top - container.scrollTop,
    width: rect.width,
    height: rect.height,
  };
}

export type SelectableKind = 'file' | 'folder';

export type SelectableRegistryEntry = {
  kind: SelectableKind;
  element: HTMLElement;
};

export function normalizeSelectionRect(start: Point, current: Point): SelectionRect {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  return {
    left,
    top,
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

export function exceedsDragThreshold(
  start: Point,
  current: Point,
  threshold = MARQUEE_DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

export function rectsIntersectClient(rect: SelectionRect, target: DOMRect): boolean {
  return !(
    rect.left + rect.width < target.left ||
    rect.left > target.right ||
    rect.top + rect.height < target.top ||
    rect.top > target.bottom
  );
}

export function collectSelectableItemsFromContainer(
  container: HTMLElement,
): Map<string, SelectableRegistryEntry> {
  const items = new Map<string, SelectableRegistryEntry>();

  for (const element of container.querySelectorAll<HTMLElement>('[data-explorer-item-id]')) {
    const itemId = element.dataset.explorerItemId;
    const kind = element.dataset.explorerItem;
    if (!itemId || (kind !== 'file' && kind !== 'folder')) continue;
    items.set(`${kind}:${itemId}`, { kind, element });
  }

  return items;
}

export function findIntersectingSelectableIds(
  rect: SelectionRect,
  items: Map<string, SelectableRegistryEntry>,
): { fileIds: string[]; folderIds: string[] } {
  const fileIds: string[] = [];
  const folderIds: string[] = [];

  for (const [, entry] of items) {
    if (!entry.element.isConnected) continue;
    const bounds = entry.element.getBoundingClientRect();
    if (!rectsIntersectClient(rect, bounds)) continue;

    const itemId = entry.element.dataset.explorerItemId;
    if (!itemId) continue;

    if (entry.kind === 'file') fileIds.push(itemId);
    else folderIds.push(itemId);
  }

  return { fileIds, folderIds };
}

export function findScrollableAncestor(
  target: HTMLElement | null,
  root: HTMLElement,
): HTMLElement | null {
  let node = target;
  while (node && root.contains(node)) {
    const style = getComputedStyle(node);
    const canScrollY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight;
    if (canScrollY) return node;
    node = node.parentElement;
  }
  return null;
}

export function isMarqueePointerType(pointerType: string): boolean {
  return pointerType === 'mouse' || pointerType === 'pen';
}

export function shouldBlockMarqueeStart(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return true;
  const element = target as HTMLElement;
  if (typeof element.closest !== 'function') return true;

  if (element.closest('[data-no-marquee-select]')) return true;
  if (element.closest('[data-explorer-item]')) return true;
  if (element.closest('button, a, input, select, textarea, [role="button"], [role="menu"]')) {
    return true;
  }
  if (element.closest('[data-testid="library-drop-overlay"]')) return true;
  return false;
}

export function mergeMarqueeSelection(
  snapshot: { fileIds: Set<string>; folderIds: Set<string> },
  intersected: { fileIds: string[]; folderIds: string[] },
  additive: boolean,
): { fileIds: string[]; folderIds: string[] } {
  if (!additive) {
    return {
      fileIds: intersected.fileIds,
      folderIds: intersected.folderIds,
    };
  }

  return {
    fileIds: [...new Set([...snapshot.fileIds, ...intersected.fileIds])],
    folderIds: [...new Set([...snapshot.folderIds, ...intersected.folderIds])],
  };
}
