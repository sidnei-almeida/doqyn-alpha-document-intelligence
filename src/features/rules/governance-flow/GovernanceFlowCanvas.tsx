import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type EdgeChange,
  type NodeChange,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
// Estilos base do React Flow — importados uma única vez, no componente de entrada do canvas.
import '@xyflow/react/dist/style.css';
import { CategoryCardNode } from './CategoryCardNode';
import { GroupCardNode } from './GroupCardNode';
import { PermissionEdge } from './PermissionEdge';
import {
  REACT_FLOW_HIDE_ATTRIBUTION,
  REACT_FLOW_SHOW_MINIMAP,
} from './reactFlowUiConfig';
import type { FlowPosition, GovernanceFlowNode, PermissionFlowEdge } from './types';
import { parseCategoryNodeId, parseGroupNodeId } from './types';

const nodeTypes = {
  categoryCard: CategoryCardNode,
  groupCard: GroupCardNode,
};

const edgeTypes = {
  permission: PermissionEdge,
};

type GovernanceFlowCanvasProps = {
  nodes: GovernanceFlowNode[];
  edges: PermissionFlowEdge[];
  isAdmin: boolean;
  /** Delete/Backspace só removem arestas quando true (ex.: nenhum dialog aberto). */
  deletionEnabled: boolean;
  onMoveNode: (nodeId: string, position: FlowPosition) => void;
  onNodeDragStart: () => void;
  onNodeDragStop: () => void;
  onConnectEdge: (categoryId: string, groupId: string) => void;
  isValidConnection: (connection: Connection | Edge) => boolean;
  onEdgeSelect: (edgeId: string | null) => void;
  onEdgeOpenDetail: (edgeId: string) => void;
  onEdgeHover: (edgeId: string | null) => void;
  onEdgesRemoved: (edgeIds: string[]) => void;
  /** Recebe a instância do React Flow (fitView programático após reorganizar). */
  onInit?: (instance: ReactFlowInstance<GovernanceFlowNode, PermissionFlowEdge>) => void;
  topRightPanel?: ReactNode;
  topCenterPanel?: ReactNode;
  bottomCenterPanel?: ReactNode;
};

/**
 * Canvas interativo do mapa de governança (React Flow): cards arrastáveis,
 * conexões bezier por handle, zoom/pan e fundo pontilhado.
 */
export function GovernanceFlowCanvas({
  nodes,
  edges,
  isAdmin,
  deletionEnabled,
  onMoveNode,
  onNodeDragStart,
  onNodeDragStop,
  onConnectEdge,
  isValidConnection,
  onEdgeSelect,
  onEdgeOpenDetail,
  onEdgeHover,
  onEdgesRemoved,
  onInit,
  topRightPanel,
  topCenterPanel,
  bottomCenterPanel,
}: GovernanceFlowCanvasProps) {
  const isDraggingRef = useRef(false);
  const [rfNodes, setRfNodes] = useState(nodes);

  // Sincroniza props do pai (undo, layout, hover) — mas não durante o drag,
  // para evitar resetar medições internas do React Flow e o flicker do grafo.
  useEffect(() => {
    if (isDraggingRef.current) return;
    setRfNodes(nodes);
  }, [nodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<GovernanceFlowNode>[]) => {
      setRfNodes((current) => applyNodeChanges(changes, current));

      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging === false) {
          onMoveNode(change.id, change.position);
        }
      }
    },
    [onMoveNode],
  );

  const handleNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
    onNodeDragStart();
  }, [onNodeDragStart]);

  const handleNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    onNodeDragStop();
  }, [onNodeDragStop]);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<PermissionFlowEdge>[]) => {
      const selectionChanges = changes.filter((change) => change.type === 'select');
      if (selectionChanges.length === 0) return;
      const selectedChange = selectionChanges.find((change) => change.selected);
      onEdgeSelect(selectedChange ? selectedChange.id : null);
    },
    [onEdgeSelect],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const categoryId = parseCategoryNodeId(connection.source ?? '');
      const groupId = parseGroupNodeId(connection.target ?? '');
      if (!categoryId || !groupId) return;
      onConnectEdge(categoryId, groupId);
    },
    [onConnectEdge],
  );

  const handleEdgesDelete = useCallback(
    (deleted: PermissionFlowEdge[]) => {
      onEdgesRemoved(deleted.map((edge) => edge.id));
    },
    [onEdgesRemoved],
  );

  const deleteKeyCode = useMemo(
    () => (isAdmin && deletionEnabled ? ['Delete', 'Backspace'] : null),
    [deletionEnabled, isAdmin],
  );

  return (
    <ReactFlowProvider>
      {/* Wrapper com dimensões definidas — o React Flow exige um pai mensurável. */}
      <div className="absolute inset-0">
        <ReactFlow<GovernanceFlowNode, PermissionFlowEdge>
          className="governance-flow"
          nodes={rfNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          isValidConnection={isValidConnection}
          onEdgeDoubleClick={(_, edge) => onEdgeOpenDetail(edge.id)}
          onEdgeMouseEnter={(_, edge) => onEdgeHover(edge.id)}
          onEdgeMouseLeave={() => onEdgeHover(null)}
          onEdgesDelete={handleEdgesDelete}
          onPaneClick={() => onEdgeSelect(null)}
          onInit={onInit}
          deleteKeyCode={deleteKeyCode}
          nodesDraggable={isAdmin}
          nodesConnectable={isAdmin}
          nodesFocusable={false}
          edgesFocusable
          elevateEdgesOnSelect
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.75}
          connectionRadius={28}
          connectionLineStyle={{ stroke: 'var(--accent-active)', strokeWidth: 2 }}
          proOptions={{ hideAttribution: REACT_FLOW_HIDE_ATTRIBUTION }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="var(--border-default)"
          />
          <Controls showInteractive={false} position="bottom-left" />
          {REACT_FLOW_SHOW_MINIMAP ? (
            <MiniMap
              className="governance-flow-minimap"
              pannable
              zoomable
              nodeColor={miniMapNodeColor}
              nodeStrokeWidth={2}
            />
          ) : null}
          {topRightPanel && <Panel position="top-right">{topRightPanel}</Panel>}
          {topCenterPanel && <Panel position="top-center">{topCenterPanel}</Panel>}
          {bottomCenterPanel && <Panel position="bottom-center">{bottomCenterPanel}</Panel>}
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

function miniMapNodeColor(node: Node): string {
  return node.type === 'categoryCard' ? 'var(--accent-active)' : 'var(--text-tertiary)';
}
