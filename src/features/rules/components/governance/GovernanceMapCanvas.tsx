import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarkerType, type Connection, type Edge, type ReactFlowInstance } from '@xyflow/react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { toast } from 'sonner';
import { useConfirm } from '@/components/confirm/useConfirm';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import {
  listGovernanceEdges,
  type GovernanceEdge,
} from '../../utils/governanceConnections';
import {
  buildEdgeId,
  type GovernanceEdgeDiff,
} from '../../utils/governanceMapDraft';
import { buildCategoryColorMap } from '../../utils/governanceMapUi';
import { GovernanceFlowCanvas } from '../../governance-flow/GovernanceFlowCanvas';
import { SaveConfirmModal } from '../../governance-flow/SaveConfirmModal';
import {
  useGovernanceFlowDraft,
  useUnsavedMapChangesGuard,
} from '../../governance-flow/useGovernanceFlowDraft';
import { isValidGovernanceConnection } from '../../governance-flow/validation';
import { buildSpreadGovernancePositions, FLOW_NODE_WIDTH } from '../../governance-flow/layout';
import {
  categoryNodeId,
  groupNodeId,
  type CategoryFlowNode,
  type GovernanceFlowNode,
  type GroupFlowNode,
  type PermissionFlowEdge,
} from '../../governance-flow/types';
import { GovernanceMapSummary } from './GovernanceMapSummary';
import {
  GovernanceDetailDialog,
  type GovernanceEntitySelection,
} from './GovernanceDetailDialog';

type GovernanceMapCanvasProps = {
  categories: DocumentCategory[];
  groups: Group[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onCreateCategory: () => void;
  onCreateGroup: () => void;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
  onSaveMapChanges: (diff: GovernanceEdgeDiff) => Promise<GovernanceEdge[]>;
  onSaveCategory: (
    categoryId: string,
    input: { name: string; description?: string },
  ) => Promise<void>;
  onSaveGroup: (groupId: string, input: { name: string; description?: string }) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
  onDeactivateGroup?: (groupId: string) => Promise<void>;
  onConfigureExtraction?: (category: DocumentCategory) => void;
  extractionConfiguredCategoryIds?: Set<string>;
  className?: string;
};

type HoveredNode = { type: 'category' | 'group'; id: string };

const STROKE_OPACITY_IDLE = 0.62;
const STROKE_OPACITY_FOCUSED = 0.28;
const STROKE_OPACITY_HIGHLIGHT = 0.98;

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'),
  );
}

function useNodeHighlightMaps(edges: GovernanceEdge[]) {
  return useMemo(() => {
    const categoryToGroups = new Map<string, Set<string>>();
    const groupToCategories = new Map<string, Set<string>>();

    for (const edge of edges) {
      if (!categoryToGroups.has(edge.sourceId)) categoryToGroups.set(edge.sourceId, new Set());
      categoryToGroups.get(edge.sourceId)!.add(edge.targetId);

      if (!groupToCategories.has(edge.targetId)) groupToCategories.set(edge.targetId, new Set());
      groupToCategories.get(edge.targetId)!.add(edge.sourceId);
    }

    return { categoryToGroups, groupToCategories };
  }, [edges]);
}

export function GovernanceMapCanvas({
  categories,
  groups,
  groupMemberCounts,
  isAdmin,
  onCreateCategory,
  onCreateGroup,
  onPermissionChange,
  onSaveMapChanges,
  onSaveCategory,
  onSaveGroup,
  onDeleteCategory,
  onDeactivateGroup,
  onConfigureExtraction,
  extractionConfiguredCategoryIds,
  className,
}: GovernanceMapCanvasProps) {
  const confirm = useConfirm();
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [detailSelection, setDetailSelection] = useState<GovernanceEntitySelection | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectGroupId, setConnectGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  useEffect(() => {
    if (!isMapFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMapFullscreen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapFullscreen]);

  const serverEdges = useMemo(
    () => listGovernanceEdges(categories, groups),
    [categories, groups],
  );

  const categoryIds = useMemo(() => categories.map((category) => category.id), [categories]);
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups]);

  const {
    originalEdges,
    draftEdges,
    positions,
    defaultPositions,
    dirty,
    pendingCounts,
    canUndo,
    canRedo,
    saving,
    setSaving,
    addEdge,
    removeEdge,
    updateEdgePermissions,
    beginNodeDrag,
    moveNode,
    endNodeDrag,
    applyLayout,
    undo,
    redo,
    discard,
    commitSaved,
    getDiff,
  } = useGovernanceFlowDraft({ serverEdges, categoryIds, groupIds });

  useUnsavedMapChangesGuard(dirty, discard, confirm);

  const spreadPositions = useMemo(
    () => buildSpreadGovernancePositions(categoryIds, groupIds),
    [categoryIds, groupIds],
  );

  const flowInstanceRef = useRef<ReactFlowInstance<GovernanceFlowNode, PermissionFlowEdge> | null>(
    null,
  );

  const handleAutoOrganize = useCallback(() => {
    applyLayout(spreadPositions);
    // fitView após o layout ser aplicado nos nodes (próximo frame).
    requestAnimationFrame(() => {
      flowInstanceRef.current?.fitView({ padding: 0.08, duration: 400, maxZoom: 1 });
    });
  }, [applyLayout, spreadPositions]);

  const edges = draftEdges;
  const edgeById = useMemo(() => new Map(edges.map((edge) => [edge.id, edge])), [edges]);
  const { categoryToGroups, groupToCategories } = useNodeHighlightMaps(edges);
  const categoryColors = useMemo(() => buildCategoryColorMap(categories), [categories]);

  const hoveredCategoryId = hoveredNode?.type === 'category' ? hoveredNode.id : null;
  const hoveredGroupId = hoveredNode?.type === 'group' ? hoveredNode.id : null;
  const selectedCategoryId = detailSelection?.type === 'category' ? detailSelection.id : null;
  const selectedGroupId = detailSelection?.type === 'group' ? detailSelection.id : null;

  const hasHighlightFocus = Boolean(
    hoveredCategoryId ||
      hoveredGroupId ||
      selectedCategoryId ||
      selectedGroupId ||
      selectedEdgeId ||
      hoveredEdgeId,
  );

  const isCategoryHighlighted = useCallback(
    (categoryId: string) => {
      if (hoveredCategoryId === categoryId) return true;
      if (selectedCategoryId === categoryId) return true;
      if (hoveredGroupId && groupToCategories.get(hoveredGroupId)?.has(categoryId)) return true;
      if (selectedGroupId && groupToCategories.get(selectedGroupId)?.has(categoryId)) return true;
      return false;
    },
    [groupToCategories, hoveredCategoryId, hoveredGroupId, selectedCategoryId, selectedGroupId],
  );

  const isGroupHighlighted = useCallback(
    (groupId: string) => {
      if (hoveredGroupId === groupId) return true;
      if (selectedGroupId === groupId) return true;
      if (hoveredCategoryId && categoryToGroups.get(hoveredCategoryId)?.has(groupId)) return true;
      if (selectedCategoryId && categoryToGroups.get(selectedCategoryId)?.has(groupId)) return true;
      return false;
    },
    [categoryToGroups, hoveredCategoryId, hoveredGroupId, selectedCategoryId, selectedGroupId],
  );

  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const searchQuery = search.trim().toLowerCase();
  const searchActive = searchQuery.length > 0;

  const visibleCategoryIds = useMemo(() => {
    if (!searchActive) return new Set(categoryIds);
    return new Set(
      categories
        .filter((item) => item.name.toLowerCase().includes(searchQuery))
        .map((item) => item.id),
    );
  }, [categories, categoryIds, searchActive, searchQuery]);

  const visibleGroupIds = useMemo(() => {
    if (!searchActive) return new Set(groupIds);
    return new Set(
      groups.filter((item) => item.name.toLowerCase().includes(searchQuery)).map((item) => item.id),
    );
  }, [groups, groupIds, searchActive, searchQuery]);

  const connectGroup = useMemo(
    () => (connectGroupId ? groups.find((item) => item.id === connectGroupId) : null),
    [connectGroupId, groups],
  );

  const cancelConnectMode = useCallback(() => {
    setConnectGroupId(null);
  }, []);

  const startConnectMode = useCallback((groupId: string) => {
    setConnectGroupId(groupId);
    setDetailSelection(null);
  }, []);

  const handleMemberCountClick = useCallback(() => {
    toast.info('Gerencie membros de grupos documentais na tela Usuários.', {
      action: {
        label: 'Abrir Usuários',
        onClick: () => {
          window.location.href = '/users';
        },
      },
    });
  }, []);

  const performDraftDisconnect = useCallback(
    (groupId: string, categoryId: string) => {
      if (!isAdmin) return;
      removeEdge(buildEdgeId(categoryId, groupId));
      setHoveredEdgeId(null);
      setHoveredNode(null);
    },
    [isAdmin, removeEdge],
  );

  const openConnectionDetail = useCallback(
    (categoryId: string, groupId: string) => {
      const edge = edgeById.get(buildEdgeId(categoryId, groupId));
      if (!edge) return;
      setSelectedEdgeId(edge.id);
      setDetailSelection({
        type: 'connection',
        categoryId: edge.sourceId,
        groupId: edge.targetId,
      });
    },
    [edgeById],
  );

  const isDraftOnlyConnection = useMemo(() => {
    if (detailSelection?.type !== 'connection') return false;
    const edgeId = buildEdgeId(detailSelection.categoryId, detailSelection.groupId);
    const inDraft = draftEdges.some((edge) => edge.id === edgeId);
    const inOriginal = originalEdges.some((edge) => edge.id === edgeId);
    return inDraft && !inOriginal;
  }, [detailSelection, draftEdges, originalEdges]);

  useEffect(() => {
    if (!selectedEdgeId) return;
    if (!draftEdges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [draftEdges, selectedEdgeId]);

  useEffect(() => {
    if (!connectGroupId || detailSelection !== null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelConnectMode();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cancelConnectMode, connectGroupId, detailSelection]);

  // Atalhos Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y para desfazer e refazer.
  useEffect(() => {
    if (!isAdmin) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isEditableKeyboardTarget(event.target)) return;
      if (detailSelection !== null || saveModalOpen) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [detailSelection, isAdmin, redo, saveModalOpen, undo]);

  const handleConnect = useCallback(
    (categoryId: string, groupId: string) => {
      const edgeId = buildEdgeId(categoryId, groupId);
      const existing = draftEdges.find((edge) => edge.id === edgeId);
      if (existing) {
        openConnectionDetail(categoryId, groupId);
        setConnectGroupId(null);
        return;
      }

      addEdge(categoryId, groupId);
      setSelectedEdgeId(edgeId);
      setDetailSelection({ type: 'connection', categoryId, groupId });
      setConnectGroupId(null);
    },
    [addEdge, draftEdges, openConnectionDetail],
  );

  const handleSaveChanges = useCallback(async () => {
    if (!dirty || saving) return;

    setSaving(true);
    try {
      const savedEdges = await onSaveMapChanges(getDiff());
      commitSaved(savedEdges, positions);
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setSaveModalOpen(false);
    } catch {
      // toast tratado em useRules — modal permanece aberto para nova tentativa
    } finally {
      setSaving(false);
    }
  }, [commitSaved, dirty, getDiff, onSaveMapChanges, positions, saving, setSaving]);

  const handleDiscardChanges = useCallback(async () => {
    const shouldDiscard = await confirm({
      title: 'Descartar alterações?',
      description:
        'Todas as conexões e posições não salvas voltarão ao último estado salvo do mapa.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Continuar editando',
      variant: 'warning',
    });
    if (!shouldDiscard) return;
    discard();
    setSelectedEdgeId(null);
    setHoveredEdgeId(null);
  }, [confirm, discard]);

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      if (connectGroupId && isAdmin) {
        handleConnect(categoryId, connectGroupId);
        return;
      }
      setSelectedEdgeId(null);
      setDetailSelection({ type: 'category', id: categoryId });
    },
    [connectGroupId, handleConnect, isAdmin],
  );

  const buildCategoryLinks = useCallback(
    (categoryId: string) => {
      const connectedIds = categoryToGroups.get(categoryId);
      if (!connectedIds) return [];
      return [...connectedIds].flatMap((groupId) => {
        const edge = edgeById.get(buildEdgeId(categoryId, groupId));
        if (!edge) return [];
        return [
          {
            groupId,
            groupName: groupNameById.get(groupId) ?? groupId,
            permissions: edge.permissions,
          },
        ];
      });
    },
    [categoryToGroups, edgeById, groupNameById],
  );

  const buildGroupLinks = useCallback(
    (groupId: string) => {
      const connectedIds = groupToCategories.get(groupId);
      if (!connectedIds) return [];
      return [...connectedIds].flatMap((categoryId) => {
        const edge = edgeById.get(buildEdgeId(categoryId, groupId));
        if (!edge) return [];
        return [
          {
            categoryId,
            categoryName: categoryNameById.get(categoryId) ?? categoryId,
            permissions: edge.permissions,
          },
        ];
      });
    },
    [categoryNameById, edgeById, groupToCategories],
  );

  const flowNodes = useMemo<GovernanceFlowNode[]>(() => {
    const categoryNodes: CategoryFlowNode[] = categories.map((category) => {
      const nodeId = categoryNodeId(category.id);
      return {
        id: nodeId,
        type: 'categoryCard',
        position: positions[nodeId] ?? defaultPositions[nodeId] ?? { x: 0, y: 0 },
        draggable: isAdmin,
        selectable: false,
        deletable: false,
        hidden: searchActive && !visibleCategoryIds.has(category.id),
        style: { width: FLOW_NODE_WIDTH },
        data: {
          category,
          connectedGroupCount: categoryToGroups.get(category.id)?.size ?? 0,
          connectedLinks: buildCategoryLinks(category.id),
          hasExtractionConfig: extractionConfiguredCategoryIds?.has(category.id) ?? false,
          selected: detailSelection?.type === 'category' && detailSelection.id === category.id,
          highlighted: isCategoryHighlighted(category.id),
          dimmed: hasHighlightFocus && !isCategoryHighlighted(category.id),
          connectMode: Boolean(connectGroupId),
          connectGroupName: connectGroup?.name,
          isAdmin,
          onSelect: () => handleCategoryClick(category.id),
          onOpenConnection: (groupId: string) => openConnectionDetail(category.id, groupId),
          onHoverStart: () => setHoveredNode({ type: 'category', id: category.id }),
          onHoverEnd: () => setHoveredNode(null),
        },
      };
    });

    const groupNodes: GroupFlowNode[] = groups.map((group) => {
      const nodeId = groupNodeId(group.id);
      return {
        id: nodeId,
        type: 'groupCard',
        position: positions[nodeId] ?? defaultPositions[nodeId] ?? { x: 0, y: 0 },
        draggable: isAdmin,
        selectable: false,
        deletable: false,
        hidden: searchActive && !visibleGroupIds.has(group.id),
        style: { width: FLOW_NODE_WIDTH },
        data: {
          group,
          memberCount: groupMemberCounts[group.id] ?? group.memberCount ?? 0,
          selected: detailSelection?.type === 'group' && detailSelection.id === group.id,
          highlighted: isGroupHighlighted(group.id),
          dimmed: hasHighlightFocus && !isGroupHighlighted(group.id),
          connectSource: connectGroupId === group.id,
          isAdmin,
          connectedLinks: buildGroupLinks(group.id),
          onSelect: () => {
            setSelectedEdgeId(null);
            setDetailSelection({ type: 'group', id: group.id });
          },
          onStartConnect: isAdmin ? () => startConnectMode(group.id) : undefined,
          onDisconnectFromCategory: isAdmin
            ? (categoryId: string) => performDraftDisconnect(group.id, categoryId)
            : undefined,
          onOpenConnection: (categoryId: string) => openConnectionDetail(categoryId, group.id),
          onMemberCountClick: handleMemberCountClick,
          onHoverStart: () => setHoveredNode({ type: 'group', id: group.id }),
          onHoverEnd: () => setHoveredNode(null),
        },
      };
    });

    return [...categoryNodes, ...groupNodes];
  }, [
    buildCategoryLinks,
    buildGroupLinks,
    categories,
    categoryToGroups,
    connectGroup?.name,
    connectGroupId,
    defaultPositions,
    detailSelection,
    extractionConfiguredCategoryIds,
    groupMemberCounts,
    groups,
    handleCategoryClick,
    handleMemberCountClick,
    hasHighlightFocus,
    isAdmin,
    isCategoryHighlighted,
    isGroupHighlighted,
    openConnectionDetail,
    performDraftDisconnect,
    positions,
    searchActive,
    startConnectMode,
    visibleCategoryIds,
    visibleGroupIds,
  ]);

  const flowEdges = useMemo<PermissionFlowEdge[]>(
    () =>
      edges.map((edge) => {
        const selected = selectedEdgeId === edge.id;
        const highlighted =
          selected ||
          hoveredEdgeId === edge.id ||
          hoveredCategoryId === edge.sourceId ||
          hoveredGroupId === edge.targetId ||
          selectedCategoryId === edge.sourceId ||
          selectedGroupId === edge.targetId;
        // Cor da linha herda a cor da categoria de origem (token --color-cat-*).
        const stroke = categoryColors[edge.sourceId] ?? 'var(--folder-accent-default)';

        return {
          id: edge.id,
          type: 'permission' as const,
          source: categoryNodeId(edge.sourceId),
          target: groupNodeId(edge.targetId),
          selected,
          deletable: isAdmin,
          hidden:
            searchActive &&
            (!visibleCategoryIds.has(edge.sourceId) || !visibleGroupIds.has(edge.targetId)),
          style: {
            stroke,
            strokeWidth: selected ? 2.5 : highlighted ? 2.25 : 1.5,
            strokeOpacity: highlighted
              ? STROKE_OPACITY_HIGHLIGHT
              : hasHighlightFocus
                ? STROKE_OPACITY_FOCUSED
                : STROKE_OPACITY_IDLE,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: stroke,
            width: 14,
            height: 14,
          },
          data: {
            categoryName: categoryNameById.get(edge.sourceId) ?? edge.sourceId,
            groupName: groupNameById.get(edge.targetId) ?? edge.targetId,
            canRemove: isAdmin,
            onRemove: (edgeId: string) => {
              const target = edgeById.get(edgeId);
              if (target) performDraftDisconnect(target.targetId, target.sourceId);
            },
          },
        };
      }),
    [
      categoryColors,
      categoryNameById,
      edgeById,
      edges,
      groupNameById,
      hasHighlightFocus,
      hoveredCategoryId,
      hoveredEdgeId,
      hoveredGroupId,
      isAdmin,
      performDraftDisconnect,
      searchActive,
      selectedCategoryId,
      selectedEdgeId,
      selectedGroupId,
      visibleCategoryIds,
      visibleGroupIds,
    ],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      isValidGovernanceConnection(connection.source, connection.target, draftEdges),
    [draftEdges],
  );

  const handleEdgesRemoved = useCallback(
    (edgeIds: string[]) => {
      for (const edgeId of edgeIds) {
        const edge = edgeById.get(edgeId);
        if (edge) performDraftDisconnect(edge.targetId, edge.sourceId);
      }
    },
    [edgeById, performDraftDisconnect],
  );

  const handleEdgeOpenDetail = useCallback(
    (edgeId: string) => {
      const edge = edgeById.get(edgeId);
      if (!edge) return;
      openConnectionDetail(edge.sourceId, edge.targetId);
    },
    [edgeById, openConnectionDetail],
  );

  const isFullyEmpty = categories.length === 0 && groups.length === 0;
  const showConnectionHint = categories.length > 0 && groups.length > 0 && edges.length === 0;
  const searchHasNoResults =
    searchActive &&
    ((categories.length > 0 && visibleCategoryIds.size === 0) ||
      (groups.length > 0 && visibleGroupIds.size === 0));

  const pendingSummary = [
    pendingCounts.added > 0 &&
      `${pendingCounts.added} ${pendingCounts.added === 1 ? 'conexão adicionada' : 'conexões adicionadas'}`,
    pendingCounts.removed > 0 &&
      `${pendingCounts.removed} ${pendingCounts.removed === 1 ? 'conexão removida' : 'conexões removidas'}`,
    pendingCounts.moved > 0 &&
      `${pendingCounts.moved} ${pendingCounts.moved === 1 ? 'card movido' : 'cards movidos'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className={cn('rules-map flex min-h-0 flex-1 flex-col gap-4', className)}>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Icon name="search" size={ICON_SIZE.xs} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-doqyn-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar categorias ou grupos documentais…"
              className="h-9 w-full rounded-lg border border-doqyn-border bg-doqyn-surface pl-9 pr-3 text-sm text-doqyn-text placeholder:text-doqyn-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-primary"
            />
          </div>
          {isAdmin && (
            <>
              <Button type="button" variant="secondary" onClick={onCreateCategory}>
                Nova categoria
              </Button>
              <Button type="button" variant="secondary" onClick={onCreateGroup}>
                <Icon name="add" size={ICON_SIZE.xs} />
                Novo grupo
              </Button>
            </>
          )}
        </div>

        {!isFullyEmpty && (
          <GovernanceMapSummary
            categoryCount={categories.length}
            groupCount={groups.length}
            connectionCount={edges.length}
            isAdmin={isAdmin}
          />
        )}

        {searchHasNoResults && (
          <p className="rounded-lg border border-dashed border-doqyn-border-subtle bg-doqyn-surface/60 px-4 py-3 text-center text-sm text-doqyn-muted">
            Nenhum resultado para &quot;{search.trim()}&quot;. Tente outro termo.
          </p>
        )}

        {!isFullyEmpty && categories.length === 0 && (
          <p className="rounded-lg border border-dashed border-doqyn-border/60 px-3 py-2 text-center text-sm text-doqyn-muted">
            Nenhuma categoria criada ainda.
          </p>
        )}

        {!isFullyEmpty && groups.length === 0 && (
          <p className="rounded-lg border border-dashed border-doqyn-border-subtle px-3 py-2 text-center text-sm text-doqyn-muted">
            Nenhum grupo documental criado ainda.
          </p>
        )}

        {connectGroupId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-doqyn-primary/40 bg-doqyn-primary-bg px-3 py-2 text-sm text-doqyn-primary">
            <span>
              Modo conexão ativo
              {connectGroup ? ` para "${connectGroup.name}"` : ''}: clique em uma categoria para
              criar ou editar a regra de acesso.
            </span>
            <Button type="button" variant="ghost" onClick={cancelConnectMode}>
              Cancelar conexão
            </Button>
          </div>
        )}

        {isAdmin && dirty && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-surface px-3 py-2">
            <p className="text-sm text-doqyn-muted">
              {pendingCounts.total === 1
                ? '1 alteração pendente'
                : `${pendingCounts.total} alterações pendentes`}
              {pendingSummary && (
                <span className="ml-2 text-xs text-doqyn-subtle">({pendingSummary})</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" disabled={!canUndo} onClick={undo}>
                <Icon name="undo" size={ICON_SIZE.xs} />
                Desfazer
              </Button>
              <Button type="button" variant="ghost" disabled={!canRedo} onClick={redo}>
                <Icon name="redo" size={ICON_SIZE.xs} />
                Refazer
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleDiscardChanges()}>
                <Icon name="cancel" size={ICON_SIZE.xs} />
                Descartar alterações
              </Button>
              <Button type="button" disabled={saving} onClick={() => setSaveModalOpen(true)}>
                <Icon name="save" size={ICON_SIZE.xs} />
                Salvar alterações
              </Button>
            </div>
          </div>
        )}

        {isFullyEmpty ? (
          <EmptyState
            stretch
            title="Mapa de governança vazio"
            description="Crie categorias e grupos documentais para começar a conectar permissões."
            action={
              isAdmin ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={onCreateCategory}>
                    Nova categoria
                  </Button>
                  <Button type="button" variant="secondary" onClick={onCreateGroup}>
                    Novo grupo
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div
            className={cn(
              'rules-map-canvas relative flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-canvas lg:min-h-[480px]',
              isMapFullscreen && 'rules-map-canvas--fullscreen',
            )}
          >
            <GovernanceFlowCanvas
              nodes={flowNodes}
              edges={flowEdges}
              isAdmin={isAdmin}
              onInit={(instance) => {
                flowInstanceRef.current = instance;
              }}
              deletionEnabled={detailSelection === null && !saveModalOpen}
              onMoveNode={moveNode}
              onNodeDragStart={beginNodeDrag}
              onNodeDragStop={endNodeDrag}
              onConnectEdge={handleConnect}
              isValidConnection={isValidConnection}
              onEdgeSelect={setSelectedEdgeId}
              onEdgeOpenDetail={handleEdgeOpenDetail}
              onEdgeHover={setHoveredEdgeId}
              onEdgesRemoved={handleEdgesRemoved}
              topRightPanel={
                <div className="flex items-center gap-1 rounded-full border border-doqyn-border-subtle bg-doqyn-surface/90 p-1 shadow-sm backdrop-blur-sm">
                  {isAdmin && (
                    <IconButton
                      label="Organizar automaticamente"
                      onClick={handleAutoOrganize}
                    >
                      <Icon name="auto_fix_high" size={ICON_SIZE.xs} aria-hidden />
                    </IconButton>
                  )}
                  <IconButton
                    label={isMapFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                    onClick={() => setIsMapFullscreen((value) => !value)}
                  >
                    {isMapFullscreen ? (
                      <Icon name="fullscreen_exit" size={ICON_SIZE.xs} aria-hidden />
                    ) : (
                      <Icon name="fullscreen" size={ICON_SIZE.xs} aria-hidden />
                    )}
                  </IconButton>
                </div>
              }
              topCenterPanel={
                showConnectionHint ? (
                  <div className="pointer-events-none max-w-sm rounded-2xl border border-doqyn-border-subtle bg-doqyn-surface/90 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
                    <p className="text-sm font-medium text-doqyn-text">Comece conectando acesso</p>
                    <p className="mt-1 text-xs text-doqyn-muted">
                      Arraste do conector à direita de uma categoria até um grupo documental, ou use
                      o ícone de ramo no card do grupo.
                    </p>
                  </div>
                ) : undefined
              }
            />
          </div>
        )}

        {isAdmin && groups.length > 0 && !isFullyEmpty && (
          <p className="text-xs text-doqyn-muted">
            Membros dos grupos são gerenciados em{' '}
            <Link to="/users" className="font-medium text-doqyn-primary hover:underline">
              Usuários
            </Link>
            .
          </p>
        )}
      </div>

      <GovernanceDetailDialog
        open={detailSelection !== null}
        selection={detailSelection}
        categories={categories}
        groups={groups}
        groupMemberCounts={groupMemberCounts}
        isAdmin={isAdmin}
        isDraftOnlyConnection={isDraftOnlyConnection}
        draftConnectionPermissions={
          detailSelection?.type === 'connection'
            ? edgeById.get(buildEdgeId(detailSelection.categoryId, detailSelection.groupId))
                ?.permissions ?? null
            : null
        }
        onClose={() => {
          setDetailSelection(null);
          setSelectedEdgeId(null);
        }}
        onSaveCategory={onSaveCategory}
        onSaveGroup={onSaveGroup}
        onDeleteCategory={onDeleteCategory}
        onDeactivateGroup={onDeactivateGroup}
        onPermissionChange={onPermissionChange}
        onDraftPermissionChange={(edgeId, permissions) => updateEdgePermissions(edgeId, permissions)}
        onDisconnect={async (groupId, categoryId) => {
          performDraftDisconnect(groupId, categoryId);
        }}
        onSelectConnection={(categoryId, groupId) => openConnectionDetail(categoryId, groupId)}
        onConfigureExtraction={onConfigureExtraction}
        onStartConnectMode={isAdmin ? startConnectMode : undefined}
      />

      <SaveConfirmModal
        open={saveModalOpen}
        counts={pendingCounts}
        saving={saving}
        onClose={() => setSaveModalOpen(false)}
        onConfirm={() => void handleSaveChanges()}
      />
    </>
  );
}
