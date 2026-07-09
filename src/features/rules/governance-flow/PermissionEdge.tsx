import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { PermissionFlowEdge } from './types';

/**
 * Aresta bezier categoria → grupo. A cor vem de `style.stroke` (token --color-cat-*
 * da categoria de origem) e o botão × aparece na aresta selecionada.
 */
export const PermissionEdge = memo(function PermissionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps<PermissionFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const showRemove = Boolean(selected && data?.canRemove);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={18}
      />
      {showRemove && data && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <Tooltip label="Desconectar">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  data.onRemove(id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-doqyn-border bg-doqyn-surface text-sm leading-none text-doqyn-muted shadow-sm transition-colors hover:border-doqyn-danger hover:bg-doqyn-danger-bg hover:text-doqyn-danger"
                aria-label={`Desconectar categoria ${data.categoryName} do grupo ${data.groupName}`}
              >
                ×
              </button>
            </Tooltip>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
