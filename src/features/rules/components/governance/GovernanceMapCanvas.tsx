import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GitBranch, Link2, Plus, Search, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/confirm/useConfirm';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import {
  categoryDropId,
  type GroupDragData,
  parseCategoryDropId,
} from '../../dnd/types';
import {
  listGovernanceEdges,
  type GovernanceEdge,
} from '../../utils/governanceConnections';
import {
  createGovernanceEdge,
  type GovernanceEdgeDiff,
} from '../../utils/governanceMapDraft';
import {
  useGovernanceMapDraft,
  useUnsavedMapChangesGuard,
} from '../../hooks/useGovernanceMapDraft';
import { GroupChipOverlay } from '../DraggableGroupChip';
import { CategoryIcon } from '../categoryIcons';
import { ConnectionLines } from './ConnectionLines';
import { createAnchorRefFactory } from '../../utils/governanceAnchorRegistry';
import { useStableCombinedRef } from '../../hooks/useStableCombinedRef';
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
  className?: string;
};

type HoveredNode = { type: 'category' | 'group'; id: string };

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'),
  );
}

function MapCategoryCard({
  category,
  connectedGroupCount,
  selected,
  highlighted,
  dimmed,
  connectMode,
  connectGroupName,
  connectedGroupNames,
  onSelect,
  onHoverStart,
  onHoverEnd,
  anchorRef,
}: {
  category: DocumentCategory;
  connectedGroupCount: number;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  connectMode: boolean;
  connectGroupName?: string;
  connectedGroupNames: string[];
  onSelect: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  anchorRef: (node: HTMLElement | null) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: categoryDropId(category.id) });
  const combinedRef = useStableCombinedRef(setDropRef, anchorRef);

  return (
    <button
      type="button"
      ref={combinedRef}
      onClick={onSelect}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={cn(
        'w-full rounded-lg border bg-doqyn-surface p-2 text-left transition-colors duration-150',
        selected && 'border-doqyn-border-strong',
        highlighted && !selected && 'border-doqyn-border-strong bg-doqyn-card/60',
        connectMode && 'border-dashed border-doqyn-muted/50',
        isOver && 'border-doqyn-border-strong bg-doqyn-hover',
        !selected && !highlighted && !connectMode && 'border-doqyn-border-subtle hover:border-doqyn-border',
        dimmed && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-doqyn-card">
          <CategoryIcon icon={category.icon} className="h-3.5 w-3.5 text-doqyn-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-doqyn-text">{category.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-doqyn-muted">
            {category.description || 'Categoria documental'}
          </p>
          <p className="mt-0.5 text-[10px] text-doqyn-subtle">
            {connectedGroupCount}{' '}
            {connectedGroupCount === 1 ? 'grupo conectado' : 'grupos conectados'}
          </p>
          {connectedGroupNames.length > 0 && (
            <p className="mt-0.5 text-[10px] text-doqyn-muted lg:hidden">
              → {connectedGroupNames.join(', ')}
            </p>
          )}
          {connectMode && (
            <p className="mt-2 rounded-md bg-doqyn-primary-bg px-2 py-1 text-[11px] font-medium text-doqyn-primary">
              Clique para conectar {connectGroupName ? `"${connectGroupName}"` : 'este grupo'} a esta
              categoria
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function MapGroupCard({
  group,
  memberCount,
  selected,
  highlighted,
  dimmed,
  connectSource,
  isAdmin,
  connectedCategories,
  onSelect,
  onStartConnect,
  onDisconnectFromCategory,
  onMemberCountClick,
  onHoverStart,
  onHoverEnd,
  anchorRef,
}: {
  group: Group;
  memberCount: number;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  connectSource: boolean;
  isAdmin: boolean;
  connectedCategories: Array<{ id: string; name: string }>;
  onSelect: () => void;
  onStartConnect?: () => void;
  onDisconnectFromCategory?: (categoryId: string) => void;
  onMemberCountClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  anchorRef: (node: HTMLElement | null) => void;
}) {
  const styles = GROUP_COLOR_STYLES[group.color];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `map-group-${group.id}`,
    data: { type: 'group', groupId: group.id } satisfies GroupDragData,
    disabled: !isAdmin,
  });

  const combinedRef = useStableCombinedRef(setDragRef, anchorRef);

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [menuOpen]);

  const handleConnectionClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (connectedCategories.length > 0) {
      setMenuOpen((open) => !open);
      return;
    }
    onStartConnect?.();
  };

  return (
    <div
      ref={combinedRef}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={cn(
        'rounded-lg border bg-doqyn-surface transition-colors duration-150',
        styles.border,
        selected && 'border-doqyn-border-strong',
        highlighted && !selected && 'border-doqyn-border-strong bg-doqyn-card/60',
        connectSource && 'border-doqyn-border-strong',
        isDragging && 'opacity-50',
        dimmed && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-1.5 p-2">
        {isAdmin && (
          <button
            type="button"
            className="cursor-grab touch-none text-doqyn-muted active:cursor-grabbing"
            {...listeners}
            {...attributes}
            aria-label={`Arrastar grupo ${group.name}`}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
        )}
        {isAdmin && (onStartConnect || connectedCategories.length > 0) && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={handleConnectionClick}
              className={cn(
                'rounded p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text',
                menuOpen && 'bg-doqyn-hover text-doqyn-text',
              )}
              aria-label={
                connectedCategories.length > 0
                  ? `Gerenciar conexões do grupo ${group.name}`
                  : `Conectar ${group.name} a uma categoria`
              }
              aria-expanded={menuOpen}
              title="Conexões"
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
            {menuOpen && connectedCategories.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-doqyn-border bg-doqyn-surface py-1 shadow-lg">
                {connectedCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                      onDisconnectFromCategory?.(category.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
                    aria-label={`Desconectar categoria ${category.name} do grupo ${group.name}`}
                  >
                    <Unlink className="h-3 w-3 shrink-0" />
                    <span>Desconectar de &quot;{category.name}&quot;</span>
                  </button>
                ))}
                {onStartConnect && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                      onStartConnect();
                    }}
                    className="flex w-full items-center gap-2 border-t border-doqyn-border-subtle px-3 py-1.5 text-left text-[11px] text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
                  >
                    <GitBranch className="h-3 w-3 shrink-0" />
                    <span>Conectar outra categoria</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                styles.avatar,
              )}
            >
              {getInitials(group.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-doqyn-text">{group.name}</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onMemberCountClick();
                }}
                className="text-left text-[11px] text-doqyn-muted hover:text-doqyn-text hover:underline"
              >
                {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
              </button>
            </div>
          </div>
        </button>
      </div>
      <p className="border-t border-doqyn-border-subtle px-2 py-1 text-center text-[10px] text-doqyn-subtle">
        Membros gerenciados em{' '}
        <Link to="/users" className="text-doqyn-muted hover:text-doqyn-text hover:underline">
          Usuários
        </Link>
      </p>
    </div>
  );
}

function useNodeHighlightMaps(edges: ReturnType<typeof listGovernanceEdges>) {
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
  className,
}: GovernanceMapCanvasProps) {
  const confirm = useConfirm();
  const canvasRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<Record<string, HTMLElement | null>>({});
  const [anchorsVersion, setAnchorsVersion] = useState(0);
  const pendingAnchorUpdateRef = useRef(false);

  const scheduleAnchorsUpdate = useCallback(() => {
    if (pendingAnchorUpdateRef.current) return;
    pendingAnchorUpdateRef.current = true;
    requestAnimationFrame(() => {
      pendingAnchorUpdateRef.current = false;
      setAnchorsVersion((value) => value + 1);
    });
  }, []);

  const anchorFactoryRef = useRef(
    createAnchorRefFactory(anchorsRef, () => {
      scheduleAnchorsUpdate();
    }),
  );

  const getAnchorRef = useCallback((id: string) => anchorFactoryRef.current.getRef(id), []);
  const [detailSelection, setDetailSelection] = useState<GovernanceEntitySelection | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeOnly, setSelectedEdgeOnly] = useState<GovernanceEdge | null>(null);
  const [connectGroupId, setConnectGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    const validIds = new Set<string>([
      ...categories.map((category) => `category-${category.id}`),
      ...groups.map((group) => `group-${group.id}`),
    ]);
    anchorFactoryRef.current.prune(validIds);
  }, [categories, groups]);

  const serverEdges = useMemo(
    () => listGovernanceEdges(categories, groups),
    [categories, groups],
  );

  const {
    draftEdges,
    dirty,
    pendingCount,
    canUndo,
    saving,
    setSaving,
    addEdge,
    removeEdge,
    undo,
    discard,
    commitSaved,
    getDiff,
  } = useGovernanceMapDraft(serverEdges);

  useUnsavedMapChangesGuard(dirty, discard, confirm);

  const edges = draftEdges;
  const { categoryToGroups, groupToCategories } = useNodeHighlightMaps(edges);

  const selectedEdgeId = selectedEdgeOnly?.id ?? null;

  const edgeLabels = useMemo(() => {
    const labels: Record<string, { categoryName: string; groupName: string }> = {};
    for (const edge of edges) {
      labels[edge.id] = {
        categoryName: categories.find((item) => item.id === edge.sourceId)?.name ?? edge.sourceId,
        groupName: groups.find((item) => item.id === edge.targetId)?.name ?? edge.targetId,
      };
    }
    return labels;
  }, [categories, edges, groups]);

  const hoveredCategoryId = hoveredNode?.type === 'category' ? hoveredNode.id : null;
  const hoveredGroupId = hoveredNode?.type === 'group' ? hoveredNode.id : null;

  const selectedCategoryId =
    detailSelection?.type === 'category' ? detailSelection.id : null;

  const selectedGroupId = detailSelection?.type === 'group' ? detailSelection.id : null;

  const hasHighlightFocus = Boolean(
    hoveredCategoryId ||
      hoveredGroupId ||
      selectedCategoryId ||
      selectedGroupId ||
      selectedEdgeId,
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

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((item) => item.name.toLowerCase().includes(query));
  }, [categories, search]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((item) => item.name.toLowerCase().includes(query));
  }, [groups, search]);

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
      removeEdge(`${categoryId}:${groupId}`);
      setHoveredEdgeId(null);
      setHoveredNode(null);
    },
    [isAdmin, removeEdge],
  );

  const handleEdgeSelect = useCallback((edge: GovernanceEdge) => {
    setSelectedEdgeOnly(edge);
    setDetailSelection(null);
  }, []);

  const handleEdgeDisconnect = useCallback(
    (edge: GovernanceEdge) => {
      performDraftDisconnect(edge.targetId, edge.sourceId);
    },
    [performDraftDisconnect],
  );

  useEffect(() => {
    if (!selectedEdgeOnly || !isAdmin) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (isEditableKeyboardTarget(event.target)) return;
      if (detailSelection !== null) return;

      event.preventDefault();
      performDraftDisconnect(selectedEdgeOnly.targetId, selectedEdgeOnly.sourceId);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [detailSelection, isAdmin, performDraftDisconnect, selectedEdgeOnly]);

  useEffect(() => {
    if (!selectedEdgeOnly) return;
    if (!draftEdges.some((edge) => edge.id === selectedEdgeOnly.id)) {
      setSelectedEdgeOnly(null);
    }
  }, [draftEdges, selectedEdgeOnly]);

  useEffect(() => {
    if (!connectGroupId || detailSelection !== null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelConnectMode();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cancelConnectMode, connectGroupId, detailSelection]);

  const handleConnect = useCallback(
    (categoryId: string, groupId: string) => {
      const edgeId = `${categoryId}:${groupId}`;
      const existing = draftEdges.find((edge) => edge.id === edgeId);
      if (existing) {
        setSelectedEdgeOnly(existing);
        setDetailSelection(null);
        setConnectGroupId(null);
        return;
      }

      addEdge(categoryId, groupId);
      setSelectedEdgeOnly(createGovernanceEdge(categoryId, groupId));
      setDetailSelection(null);
      setConnectGroupId(null);
    },
    [addEdge, draftEdges],
  );

  const handleSaveChanges = useCallback(async () => {
    if (!dirty || saving) return;

    setSaving(true);
    try {
      const savedEdges = await onSaveMapChanges(getDiff());
      commitSaved(savedEdges);
      setSelectedEdgeOnly(null);
      setHoveredEdgeId(null);
    } catch {
      // toast tratado em useRules
    } finally {
      setSaving(false);
    }
  }, [commitSaved, dirty, getDiff, onSaveMapChanges, saving, setSaving]);

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      if (connectGroupId && isAdmin) {
        void handleConnect(categoryId, connectGroupId);
        return;
      }
      setSelectedEdgeOnly(null);
      setDetailSelection({ type: 'category', id: categoryId });
    },
    [connectGroupId, handleConnect, isAdmin],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data && (data as GroupDragData).type === 'group') {
      const group = groups.find((item) => item.id === (data as GroupDragData).groupId);
      if (group) setActiveGroup(group);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGroup(null);

    const { active, over } = event;
    if (!over || !isAdmin) return;

    const data = active.data.current;
    if (data && (data as GroupDragData).type === 'group') {
      const groupData = data as GroupDragData;
      const categoryId = parseCategoryDropId(String(over.id));
      if (categoryId) {
        handleConnect(categoryId, groupData.groupId);
      }
    }
  };

  const isFullyEmpty = categories.length === 0 && groups.length === 0;
  const showConnectionHint =
    categories.length > 0 && groups.length > 0 && edges.length === 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={cn('rules-map flex min-h-0 flex-1 flex-col gap-4', className)}>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-doqyn-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar categorias ou grupos documentais…"
              className="h-9 w-full rounded-lg border border-doqyn-border bg-doqyn-bg pl-9 pr-3 text-sm text-doqyn-text placeholder:text-doqyn-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-primary"
            />
          </div>
          {isAdmin && (
            <>
              <Button type="button" variant="secondary" onClick={onCreateCategory}>
                Nova categoria
              </Button>
              <Button type="button" variant="secondary" onClick={onCreateGroup}>
                <Plus className="h-4 w-4" />
                Novo grupo
              </Button>
            </>
          )}
        </div>

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
              {pendingCount === 1
                ? '1 alteração pendente'
                : `${pendingCount} alterações pendentes`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" disabled={!canUndo} onClick={undo}>
                Desfazer
              </Button>
              <Button type="button" variant="secondary" onClick={discard}>
                Descartar alterações
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSaveChanges()}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
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
            ref={canvasRef}
            tabIndex={selectedEdgeOnly ? 0 : -1}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedEdgeOnly(null);
              }
            }}
            className="relative flex min-h-[320px] flex-1 rounded-xl border border-doqyn-border-subtle bg-doqyn-bg p-3 outline-none lg:min-h-[480px] lg:p-4"
          >
            <div className="hidden lg:contents">
              <ConnectionLines
                containerRef={canvasRef}
                anchors={anchorsRef.current}
                anchorsVersion={anchorsVersion}
                edges={edges}
                edgeLabels={edgeLabels}
                selectedEdgeId={selectedEdgeId}
                hoveredEdgeId={hoveredEdgeId}
                hoveredCategoryId={hoveredCategoryId}
                hoveredGroupId={hoveredGroupId}
                selectedCategoryId={selectedCategoryId}
                selectedGroupId={selectedGroupId}
                isAdmin={isAdmin}
                onSelect={handleEdgeSelect}
                onHoverEdge={setHoveredEdgeId}
                onDisconnect={handleEdgeDisconnect}
              />
            </div>

            {showConnectionHint && (
              <div className="pointer-events-none absolute inset-0 z-[1] hidden items-center justify-center px-8 lg:flex">
                <p className="max-w-xs text-center text-xs text-doqyn-subtle">
                  Conecte categorias aos grupos documentais para definir o acesso.
                </p>
              </div>
            )}

            <div className="relative z-[2] grid min-h-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(72px,120px)_minmax(0,1fr)] lg:gap-0">
              <section className="rules-column flex min-h-full flex-col space-y-2">
                <header>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-doqyn-subtle">
                    Categorias
                  </h3>
                </header>
                {categories.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-doqyn-border/60 px-3 py-6 text-center text-sm text-doqyn-muted">
                    Nenhuma categoria criada ainda.
                  </p>
                ) : (
                  <div className="rules-list flex-1 space-y-2">
                    {filteredCategories.map((category) => {
                      const connectedIds = categoryToGroups.get(category.id);
                      const connectedGroupNames = connectedIds
                        ? [...connectedIds].map((id) => groupNameById.get(id) ?? id)
                        : [];

                      return (
                        <MapCategoryCard
                          key={category.id}
                          category={category}
                          connectedGroupCount={categoryToGroups.get(category.id)?.size ?? 0}
                          selected={
                            detailSelection?.type === 'category' && detailSelection.id === category.id
                          }
                          highlighted={isCategoryHighlighted(category.id)}
                          dimmed={hasHighlightFocus && !isCategoryHighlighted(category.id)}
                          connectMode={Boolean(connectGroupId)}
                          connectGroupName={connectGroup?.name}
                          connectedGroupNames={connectedGroupNames}
                          onSelect={() => handleCategoryClick(category.id)}
                          onHoverStart={() =>
                            setHoveredNode({ type: 'category', id: category.id })
                          }
                          onHoverEnd={() => setHoveredNode(null)}
                          anchorRef={getAnchorRef(`category-${category.id}`)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="hidden lg:block" aria-hidden />

              <section className="rules-column flex min-h-full flex-col space-y-2">
                <header>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-doqyn-subtle">
                    Grupos documentais
                  </h3>
                  {isAdmin && groups.length > 0 && (
                    <p className="text-[10px] text-doqyn-subtle">
                      Arraste um grupo para uma categoria ou use o ícone de conexão
                    </p>
                  )}
                </header>
                {groups.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-doqyn-border-subtle px-3 py-4 text-center text-sm text-doqyn-muted">
                    Nenhum grupo documental criado ainda.
                  </p>
                ) : (
                    <div className="rules-list flex-1 space-y-2">
                      {filteredGroups.map((group) => {
                        const connectedCategoryIds = groupToCategories.get(group.id);
                        const connectedCategoriesForGroup = connectedCategoryIds
                          ? [...connectedCategoryIds]
                              .map((id) => categories.find((item) => item.id === id))
                              .filter((item): item is DocumentCategory => Boolean(item))
                              .map((item) => ({ id: item.id, name: item.name }))
                          : [];

                        return (
                        <MapGroupCard
                          key={group.id}
                          group={group}
                          memberCount={groupMemberCounts[group.id] ?? group.memberCount ?? 0}
                          selected={
                            detailSelection?.type === 'group' && detailSelection.id === group.id
                          }
                          highlighted={isGroupHighlighted(group.id)}
                          dimmed={hasHighlightFocus && !isGroupHighlighted(group.id)}
                          connectSource={connectGroupId === group.id}
                          isAdmin={isAdmin}
                          connectedCategories={connectedCategoriesForGroup}
                          onSelect={() => {
                            setSelectedEdgeOnly(null);
                            setDetailSelection({ type: 'group', id: group.id });
                          }}
                          onStartConnect={isAdmin ? () => startConnectMode(group.id) : undefined}
                          onDisconnectFromCategory={
                            isAdmin
                              ? (categoryId) => performDraftDisconnect(group.id, categoryId)
                              : undefined
                          }
                          onMemberCountClick={handleMemberCountClick}
                          onHoverStart={() => setHoveredNode({ type: 'group', id: group.id })}
                          onHoverEnd={() => setHoveredNode(null)}
                          anchorRef={getAnchorRef(`group-${group.id}`)}
                        />
                        );
                      })}
                    </div>
                )}
              </section>
            </div>

            {edges.length > 0 && (
              <p className="relative z-[2] mt-4 text-center text-[11px] text-doqyn-muted lg:hidden">
                Conexões visíveis em telas maiores. Toque em um item para ver detalhes.
              </p>
            )}
          </div>
        )}

        {isAdmin && groups.length > 0 && (
          <p className="text-xs text-doqyn-muted">
            Dica: arraste grupos documentais para categorias ou use o ícone de conexão. Membros dos
            grupos são gerenciados em{' '}
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
        onClose={() => {
          setDetailSelection(null);
          setSelectedEdgeOnly(null);
        }}
        onSaveCategory={onSaveCategory}
        onSaveGroup={onSaveGroup}
        onDeleteCategory={onDeleteCategory}
        onDeactivateGroup={onDeactivateGroup}
        onPermissionChange={onPermissionChange}
        onConfigureExtraction={onConfigureExtraction}
        onStartConnectMode={isAdmin ? startConnectMode : undefined}
      />

      <DragOverlay dropAnimation={null}>
        {activeGroup ? <GroupChipOverlay group={activeGroup} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
