import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { GovernanceConnection } from '../../utils/governanceConnections';
import { countActivePermissions } from '../../utils/governanceConnections';

type AnchorMap = Record<string, HTMLElement | null>;

type LinePath = GovernanceConnection & {
  path: string;
  midX: number;
  midY: number;
  badge: number;
};

type ConnectionLinesProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  anchors: AnchorMap;
  connections: GovernanceConnection[];
  selectedKey: string | null;
  onSelect: (connection: GovernanceConnection) => void;
};

function anchorPoint(
  element: HTMLElement,
  containerRect: DOMRect,
  side: 'left' | 'right',
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: side === 'right' ? rect.right - containerRect.left : rect.left - containerRect.left,
    y: rect.top - containerRect.top + rect.height / 2,
  };
}

function buildCurve(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.max(48, Math.abs(to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

export function ConnectionLines({
  containerRef,
  anchors,
  connections,
  selectedKey,
  onSelect,
}: ConnectionLinesProps) {
  const [paths, setPaths] = useState<LinePath[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setPaths([]);
      return;
    }

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const next: LinePath[] = [];

      for (const connection of connections) {
        const categoryEl = anchors[`category-${connection.categoryId}`];
        const groupEl = anchors[`group-${connection.groupId}`];
        if (!categoryEl || !groupEl) continue;

        const from = anchorPoint(categoryEl, containerRect, 'right');
        const to = anchorPoint(groupEl, containerRect, 'left');
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        next.push({
          ...connection,
          path: buildCurve(from, to),
          midX,
          midY,
          badge: countActivePermissions(connection.permissions),
        });
      }

      setPaths(next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [anchors, connections, containerRef]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
      aria-hidden
    >
      {paths.map((line) => {
        const selected = selectedKey === line.key;
        return (
          <g key={line.key}>
            <path
              d={line.path}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="pointer-events-auto cursor-pointer"
              onClick={() => onSelect(line)}
            />
            <path
              d={line.path}
              fill="none"
              strokeWidth={selected ? 2.5 : 1.75}
              className={cn(
                'pointer-events-none transition-colors',
                selected ? 'stroke-doqyn-primary' : 'stroke-doqyn-border-strong/80',
              )}
            />
            <circle
              cx={line.midX}
              cy={line.midY}
              r={10}
              className={cn(
                'pointer-events-auto cursor-pointer fill-doqyn-surface stroke-doqyn-border',
                selected && 'stroke-doqyn-primary fill-doqyn-primary-bg',
              )}
              onClick={() => onSelect(line)}
            />
            <text
              x={line.midX}
              y={line.midY + 4}
              textAnchor="middle"
              className="pointer-events-none fill-doqyn-muted text-[9px] font-semibold"
            >
              {line.badge}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
