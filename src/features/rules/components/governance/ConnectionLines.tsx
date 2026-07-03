import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { GovernanceEdge } from '../../utils/governanceConnections';

type AnchorMap = Record<string, HTMLElement | null>;

type EdgeLabel = {
  categoryName: string;
  groupName: string;
};

type LinePath = GovernanceEdge & {
  path: string;
  midX: number;
  midY: number;
};

type ConnectionLinesProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  anchors: AnchorMap;
  anchorsVersion: number;
  edges: GovernanceEdge[];
  edgeLabels: Record<string, EdgeLabel>;
  selectedEdgeId: string | null;
  hoveredEdgeId: string | null;
  hoveredCategoryId: string | null;
  hoveredGroupId: string | null;
  selectedCategoryId: string | null;
  selectedGroupId: string | null;
  isAdmin: boolean;
  onSelect: (edge: GovernanceEdge) => void;
  onHoverEdge: (edgeId: string | null) => void;
  onDisconnect: (edge: GovernanceEdge) => void;
};

const STROKE_DEFAULT = 'var(--text-secondary)';
const STROKE_HIGHLIGHT = 'var(--text-primary)';

function anchorPoint(
  element: HTMLElement,
  containerRect: DOMRect,
  side: 'left' | 'right',
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  const x =
    side === 'right'
      ? rect.right - containerRect.left + 4
      : rect.left - containerRect.left - 4;
  return {
    x,
    y: rect.top - containerRect.top + rect.height / 2,
  };
}

function buildCurve(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const span = Math.abs(to.x - from.x);
  const dx = Math.max(48, span * 0.38);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function curveMidpoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = Math.max(48, Math.abs(to.x - from.x) * 0.38);
  const t = 0.5;
  const mt = 1 - t;
  const c1x = from.x + dx;
  const c1y = from.y;
  const c2x = to.x - dx;
  const c2y = to.y;
  return {
    x:
      mt * mt * mt * from.x +
      3 * mt * mt * t * c1x +
      3 * mt * t * t * c2x +
      t * t * t * to.x,
    y:
      mt * mt * mt * from.y +
      3 * mt * mt * t * c1y +
      3 * mt * t * t * c2y +
      t * t * t * to.y,
  };
}

function isEdgeHighlighted(
  edge: GovernanceEdge,
  input: {
    selectedEdgeId: string | null;
    hoveredEdgeId: string | null;
    hoveredCategoryId: string | null;
    hoveredGroupId: string | null;
    selectedCategoryId: string | null;
    selectedGroupId: string | null;
  },
): boolean {
  if (input.selectedEdgeId === edge.id) return true;
  if (input.hoveredEdgeId === edge.id) return true;
  if (input.hoveredCategoryId === edge.sourceId) return true;
  if (input.hoveredGroupId === edge.targetId) return true;
  if (input.selectedCategoryId === edge.sourceId) return true;
  if (input.selectedGroupId === edge.targetId) return true;
  return false;
}

function hasHighlightFocus(input: {
  selectedEdgeId: string | null;
  hoveredEdgeId: string | null;
  hoveredCategoryId: string | null;
  hoveredGroupId: string | null;
  selectedCategoryId: string | null;
  selectedGroupId: string | null;
}): boolean {
  return Boolean(
    input.selectedEdgeId ||
      input.hoveredEdgeId ||
      input.hoveredCategoryId ||
      input.hoveredGroupId ||
      input.selectedCategoryId ||
      input.selectedGroupId,
  );
}

function serializePaths(paths: LinePath[]): string {
  return JSON.stringify(
    paths.map((line) => ({
      id: line.id,
      path: line.path,
      midX: Math.round(line.midX),
      midY: Math.round(line.midY),
    })),
  );
}

export function ConnectionLines({
  containerRef,
  anchors,
  anchorsVersion,
  edges,
  edgeLabels,
  selectedEdgeId,
  hoveredEdgeId,
  hoveredCategoryId,
  hoveredGroupId,
  selectedCategoryId,
  selectedGroupId,
  isAdmin,
  onSelect,
  onHoverEdge,
  onDisconnect,
}: ConnectionLinesProps) {
  const [paths, setPaths] = useState<LinePath[]>([]);
  const pathsSnapshotRef = useRef('');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      if (pathsSnapshotRef.current !== '[]') {
        pathsSnapshotRef.current = '[]';
        setPaths([]);
      }
      return;
    }

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const next: LinePath[] = [];

      for (const edge of edges) {
        const categoryEl = anchors[`category-${edge.sourceId}`];
        const groupEl = anchors[`group-${edge.targetId}`];
        if (!categoryEl || !groupEl) continue;

        const from = anchorPoint(categoryEl, containerRect, 'right');
        const to = anchorPoint(groupEl, containerRect, 'left');
        const mid = curveMidpoint(from, to);

        next.push({
          ...edge,
          path: buildCurve(from, to),
          midX: mid.x,
          midY: mid.y,
        });
      }

      const snapshot = serializePaths(next);
      if (snapshot !== pathsSnapshotRef.current) {
        pathsSnapshotRef.current = snapshot;
        setPaths(next);
      }
    };

    update();
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    observer.observe(container);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [anchors, anchorsVersion, containerRef, edges]);

  const focusActive = hasHighlightFocus({
    selectedEdgeId,
    hoveredEdgeId,
    hoveredCategoryId,
    hoveredGroupId,
    selectedCategoryId,
    selectedGroupId,
  });

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 z-[1] h-full w-full overflow-visible"
      role="group"
      aria-label="Conexões entre categorias e grupos documentais"
    >
      <defs>
        <marker
          id="governance-edge-arrow"
          viewBox="0 0 10 10"
          markerWidth="7"
          markerHeight="7"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,1 L8,5 L0,9 Z" fill={STROKE_HIGHLIGHT} fillOpacity={0.9} />
        </marker>
        <marker
          id="governance-edge-arrow-muted"
          viewBox="0 0 10 10"
          markerWidth="6"
          markerHeight="6"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,1 L8,5 L0,9 Z" fill={STROKE_DEFAULT} fillOpacity={0.55} />
        </marker>
      </defs>

      {paths.map((line) => {
        const highlighted = isEdgeHighlighted(line, {
          selectedEdgeId,
          hoveredEdgeId,
          hoveredCategoryId,
          hoveredGroupId,
          selectedCategoryId,
          selectedGroupId,
        });
        const dimmed = focusActive && !highlighted;
        const selected = selectedEdgeId === line.id;
        const hovered = hoveredEdgeId === line.id;
        const showRemove = isAdmin && (hovered || selected);
        const label = edgeLabels[line.id];

        return (
          <g key={line.id} className={cn(dimmed && 'opacity-30 transition-opacity duration-200')}>
            <path
              d={line.path}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              className="pointer-events-auto cursor-pointer"
              onClick={() => onSelect(line)}
              onMouseEnter={() => onHoverEdge(line.id)}
              onMouseLeave={() => onHoverEdge(null)}
            />
            <path
              d={line.path}
              fill="none"
              stroke={highlighted ? STROKE_HIGHLIGHT : STROKE_DEFAULT}
              strokeOpacity={highlighted ? 0.9 : 0.5}
              strokeWidth={selected ? 2.25 : highlighted ? 2 : 1.5}
              strokeLinecap="round"
              markerEnd={
                highlighted
                  ? 'url(#governance-edge-arrow)'
                  : 'url(#governance-edge-arrow-muted)'
              }
              className="pointer-events-none transition-[stroke-opacity,stroke-width] duration-200"
            />
            {showRemove && label && (
              <foreignObject
                x={line.midX - 12}
                y={line.midY - 12}
                width={24}
                height={24}
                className="pointer-events-auto overflow-visible"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDisconnect(line);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-doqyn-border bg-doqyn-surface text-sm leading-none text-doqyn-muted shadow-sm transition-colors hover:border-doqyn-danger hover:bg-doqyn-danger-bg hover:text-doqyn-danger"
                  aria-label={`Desconectar categoria ${label.categoryName} do grupo ${label.groupName}`}
                  title="Desconectar"
                >
                  ×
                </button>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}
