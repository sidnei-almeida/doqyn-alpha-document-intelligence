import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { GitBranch, Link2, Plus, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import type { AuditEvent, CompanyMember, DocumentCategory, Group, PendingApproval } from '@/types/rules';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import {
  categoryDropId,
  groupDropId,
  type GroupDragData,
  type MemberDragData,
  parseCategoryDropId,
  parseGroupDropId,
} from '../../dnd/types';
import {
  DEFAULT_CONNECTION_PERMISSIONS,
  listGovernanceConnections,
} from '../../utils/governanceConnections';
import { readGroupClassPermissions } from '../../utils/groupClassPermissions';
import { DraggableGroupChip, GroupChipOverlay } from '../DraggableGroupChip';
import { PendingApprovalsPanel } from '../PendingApprovalsPanel';
import { UserCard, UserCardOverlay } from '../UserCard';
import { CategoryIcon } from '../categoryIcons';
import { ConnectionLines } from './ConnectionLines';
import { AddMemberToGroupDialog } from './AddMemberToGroupDialog';
import {
  GovernanceDetailDialog,
  type GovernanceEntitySelection,
} from './GovernanceDetailDialog';

type GovernanceMapCanvasProps = {
  categories: DocumentCategory[];
  groups: Group[];
  members: CompanyMember[];
  pendingApprovals: PendingApproval[];
  auditEvents: AuditEvent[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onCreateCategory: () => void;
  onCreateGroup: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAddMemberToGroup: (
    groupId: string,
    membershipId: string,
  ) => Promise<'added' | 'duplicate' | 'failed'>;
  onRemoveMemberFromGroup: (groupId: string, membershipId: string) => Promise<void>;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
  onSaveCategory: (
    categoryId: string,
    input: { name: string; description?: string },
  ) => Promise<void>;
  onSaveGroup: (groupId: string, input: { name: string; description?: string }) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
  onDeactivateGroup?: (groupId: string) => Promise<void>;
  onConfigureExtraction?: (category: DocumentCategory) => void;
};

function MapCategoryCard({
  category,
  selected,
  connectMode,
  connectGroupName,
  onSelect,
  registerAnchor,
}: {
  category: DocumentCategory;
  selected: boolean;
  connectMode: boolean;
  connectGroupName?: string;
  onSelect: () => void;
  registerAnchor: (id: string, node: HTMLElement | null) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: categoryDropId(category.id) });

  return (
    <button
      type="button"
      ref={(node) => {
        setDropRef(node);
        registerAnchor(`category-${category.id}`, node);
      }}
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border bg-doqyn-surface p-3 text-left transition-all',
        selected && 'border-doqyn-primary ring-1 ring-doqyn-primary/40',
        connectMode && 'border-dashed border-doqyn-primary/60',
        isOver && 'border-doqyn-primary bg-doqyn-primary-bg',
        !selected && !connectMode && 'border-doqyn-border hover:border-doqyn-border-strong',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-doqyn-primary-bg">
          <CategoryIcon icon={category.icon} className="h-4 w-4 text-doqyn-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-doqyn-text">{category.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-doqyn-muted">
            {category.description || 'Categoria documental'}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
            {category.accessGroupIds.length}{' '}
            {category.accessGroupIds.length === 1 ? 'grupo' : 'grupos'}
          </p>
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
  membersInGroup,
  memberCount,
  selected,
  connectSource,
  isAdmin,
  onSelect,
  onConnect,
  registerAnchor,
}: {
  group: Group;
  membersInGroup: CompanyMember[];
  memberCount: number;
  selected: boolean;
  connectSource: boolean;
  isAdmin: boolean;
  onSelect: () => void;
  onConnect?: () => void;
  registerAnchor: (id: string, node: HTMLElement | null) => void;
}) {
  const styles = GROUP_COLOR_STYLES[group.color];
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `map-group-${group.id}`,
    data: { type: 'group', groupId: group.id } satisfies GroupDragData,
    disabled: !isAdmin,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: groupDropId(group.id) });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
        registerAnchor(`group-${group.id}`, node);
      }}
      className={cn(
        'rounded-xl border bg-doqyn-surface transition-all',
        styles.border,
        selected && 'ring-1 ring-doqyn-primary/40',
        connectSource && 'border-doqyn-primary shadow-[0_0_0_1px] shadow-doqyn-primary/30',
        isOver && 'border-doqyn-primary bg-doqyn-primary-bg/40',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-2 border-b border-doqyn-border-subtle p-3">
        {isAdmin && (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none text-doqyn-muted active:cursor-grabbing"
            {...listeners}
            {...attributes}
            aria-label={`Arrastar grupo ${group.name}`}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
        )}
        {isAdmin && onConnect && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onConnect();
            }}
            className="mt-0.5 rounded p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-primary"
            aria-label={`Conectar ${group.name} a uma categoria`}
            title="Conectar categoria"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
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
              <p className="text-[11px] text-doqyn-muted">
                {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
              </p>
            </div>
          </div>
        </button>
      </div>
      <div className="space-y-1.5 p-3">
        {membersInGroup.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-doqyn-muted">
            {isAdmin ? 'Arraste membros aqui' : 'Sem membros'}
          </p>
        ) : (
          membersInGroup.slice(0, 4).map((member) => (
            <div
              key={member.id}
              className="truncate rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-2 py-1 text-[11px] text-doqyn-text"
            >
              {member.name}
            </div>
          ))
        )}
        {membersInGroup.length > 4 && (
          <p className="text-[10px] text-doqyn-muted">+{membersInGroup.length - 4} membros</p>
        )}
      </div>
    </div>
  );
}

export function GovernanceMapCanvas({
  categories,
  groups,
  members,
  pendingApprovals,
  isAdmin,
  onCreateCategory,
  onCreateGroup,
  onApprove,
  onReject,
  onAddMemberToGroup,
  onRemoveMemberFromGroup,
  onPermissionChange,
  onSaveCategory,
  onSaveGroup,
  onDeleteCategory,
  onDeactivateGroup,
  onConfigureExtraction,
}: GovernanceMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<Record<string, HTMLElement | null>>({});
  const [anchorsVersion, setAnchorsVersion] = useState(0);
  const [detailSelection, setDetailSelection] = useState<GovernanceEntitySelection | null>(null);
  const [connectGroupId, setConnectGroupId] = useState<string | null>(null);
  const [addMemberModal, setAddMemberModal] = useState<{
    open: boolean;
    groupId?: string;
    memberId?: string;
  }>({
    open: false,
  });
  const [search, setSearch] = useState('');
  const [activeMember, setActiveMember] = useState<CompanyMember | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const registerAnchor = useCallback((id: string, node: HTMLElement | null) => {
    if (anchorsRef.current[id] === node) return;
    anchorsRef.current[id] = node;
    setAnchorsVersion((value) => value + 1);
  }, []);

  const connections = useMemo(
    () => listGovernanceConnections(categories, groups),
    [categories, groups],
  );

  const selectedConnectionKey =
    detailSelection?.type === 'connection'
      ? `${detailSelection.categoryId}:${detailSelection.groupId}`
      : null;

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

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const active = members.filter((member) => member.status === 'active');
    if (!query) return active;
    return active.filter(
      (member) =>
        member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query),
    );
  }, [members, search]);

  const openAddMemberModal = useCallback(
    (options?: { groupId?: string; memberId?: string }) => {
      setAddMemberModal({ open: true, ...options });
    },
    [],
  );

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

  useEffect(() => {
    if (!connectGroupId || detailSelection !== null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelConnectMode();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cancelConnectMode, connectGroupId, detailSelection]);

  const handleConnect = useCallback(
    async (categoryId: string, groupId: string) => {
      const category = categories.find((item) => item.id === categoryId);
      if (!category) return;

      const existing = readGroupClassPermissions(category, groupId);
      if (Object.values(existing).some(Boolean)) {
        setDetailSelection({ type: 'connection', categoryId, groupId });
        setConnectGroupId(null);
        return;
      }

      try {
        await onPermissionChange(groupId, categoryId, DEFAULT_CONNECTION_PERMISSIONS);
        setDetailSelection({ type: 'connection', categoryId, groupId });
        setConnectGroupId(null);
        toast.success('Conexão criada.');
      } catch {
        toast.error('Não foi possível criar a conexão.');
      }
    },
    [categories, onPermissionChange],
  );

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      if (connectGroupId && isAdmin) {
        void handleConnect(categoryId, connectGroupId);
        return;
      }
      setDetailSelection({ type: 'category', id: categoryId });
    },
    [connectGroupId, handleConnect, isAdmin],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data && (data as MemberDragData).type === 'member') {
      const member = members.find((item) => item.id === (data as MemberDragData).memberId);
      if (member) setActiveMember(member);
    }
    if (data && (data as GroupDragData).type === 'group') {
      const group = groups.find((item) => item.id === (data as GroupDragData).groupId);
      if (group) setActiveGroup(group);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveMember(null);
    setActiveGroup(null);

    const { active, over } = event;
    if (!over || !isAdmin) return;

    const data = active.data.current;
    if (data && (data as MemberDragData).type === 'member') {
      const memberData = data as MemberDragData;
      const member = members.find((item) => item.id === memberData.memberId);
      const targetGroupId = parseGroupDropId(String(over.id));
      if (!member || !targetGroupId) return;
      if (member.status !== 'active') {
        toast.error('Este usuário precisa estar ativo para entrar em um grupo.');
        return;
      }
      if (member.groupIds.includes(targetGroupId)) {
        toast.info('Este membro já pertence a este grupo.');
        return;
      }

      const result = await onAddMemberToGroup(targetGroupId, member.id);
      if (result === 'added') {
        toast.success('Membro adicionado ao grupo.');
      } else if (result === 'duplicate') {
        toast.info('Este membro já pertence a este grupo.');
      }
      return;
    }

    if (data && (data as GroupDragData).type === 'group') {
      const groupData = data as GroupDragData;
      const categoryId = parseCategoryDropId(String(over.id));
      if (categoryId) {
        await handleConnect(categoryId, groupData.groupId);
      }
    }
  };

  const handleRemoveMember = useCallback(
    async (groupId: string, memberId: string) => {
      try {
        await onRemoveMemberFromGroup(groupId, memberId);
      } catch {
        toast.error('Não foi possível remover o membro do grupo.');
      }
    },
    [onRemoveMemberFromGroup],
  );

  const isEmpty = categories.length === 0 && groups.length === 0 && members.length === 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
        <PendingApprovalsPanel
          items={pendingApprovals}
          isAdmin={isAdmin}
          onApprove={onApprove}
          onReject={onReject}
        />

        <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-doqyn-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar categorias, grupos ou membros…"
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
                <Button type="button" onClick={() => openAddMemberModal()}>
                  <UserPlus className="h-4 w-4" />
                  Adicionar membro
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

          {isEmpty ? (
            <EmptyState
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
              className="relative min-h-[560px] rounded-2xl border border-doqyn-border bg-doqyn-bg/30 p-4"
            >
              <ConnectionLines
                key={anchorsVersion}
                containerRef={canvasRef}
                anchors={anchorsRef.current}
                connections={connections}
                selectedKey={selectedConnectionKey}
                onSelect={(connection) =>
                  setDetailSelection({
                    type: 'connection',
                    categoryId: connection.categoryId,
                    groupId: connection.groupId,
                  })
                }
              />

              <div className="relative z-[2] grid gap-4 lg:grid-cols-3">
                <section className="space-y-3">
                  <header>
                    <h3 className="text-sm font-semibold text-doqyn-text">Categorias</h3>
                    <p className="text-[11px] text-doqyn-muted">
                      Tipos de documentos classificados pela IA
                    </p>
                  </header>
                  <div className="space-y-2">
                    {filteredCategories.map((category) => (
                      <MapCategoryCard
                        key={category.id}
                        category={category}
                        selected={detailSelection?.type === 'category' && detailSelection.id === category.id}
                        connectMode={Boolean(connectGroupId)}
                        connectGroupName={connectGroup?.name}
                        onSelect={() => handleCategoryClick(category.id)}
                        registerAnchor={registerAnchor}
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <header>
                    <h3 className="text-sm font-semibold text-doqyn-text">Grupos</h3>
                    <p className="text-[11px] text-doqyn-muted">
                      Use o ícone de conexão ou arraste para categorias
                    </p>
                  </header>
                  {isAdmin && groups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 rounded-lg border border-doqyn-border bg-doqyn-surface p-2">
                      {groups.map((group) => (
                        <DraggableGroupChip key={group.id} group={group} isAdmin={isAdmin} />
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {filteredGroups.map((group) => {
                      const membersInGroup = members.filter(
                        (member) =>
                          member.status === 'active' && member.groupIds.includes(group.id),
                      );
                      return (
                        <MapGroupCard
                          key={group.id}
                          group={group}
                          membersInGroup={membersInGroup}
                          memberCount={membersInGroup.length}
                          selected={detailSelection?.type === 'group' && detailSelection.id === group.id}
                          connectSource={connectGroupId === group.id}
                          isAdmin={isAdmin}
                          onSelect={() => setDetailSelection({ type: 'group', id: group.id })}
                          onConnect={isAdmin ? () => startConnectMode(group.id) : undefined}
                          registerAnchor={registerAnchor}
                        />
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <header>
                    <h3 className="text-sm font-semibold text-doqyn-text">Membros</h3>
                    <p className="text-[11px] text-doqyn-muted">Arraste para um grupo documental</p>
                  </header>
                  <div className="space-y-2">
                    {filteredMembers.map((member) => (
                      <UserCard
                        key={member.id}
                        member={member}
                        sourceGroupId={null}
                        groups={groups}
                        isAdmin={isAdmin}
                        isSelected={detailSelection?.type === 'member' && detailSelection.id === member.id}
                        onSelect={() => setDetailSelection({ type: 'member', id: member.id })}
                        compact
                      />
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {isAdmin && groups.length > 0 && (
            <p className="text-xs text-doqyn-muted">
              Dica: use o ícone de conexão no grupo ou o botão no detalhe para ligar categorias.
              Arraste membros para grupos ou use &quot;Adicionar membro&quot;.
            </p>
          )}
      </div>

      <GovernanceDetailDialog
        open={detailSelection !== null}
        selection={detailSelection}
        categories={categories}
        groups={groups}
        members={members}
        isAdmin={isAdmin}
        onClose={() => setDetailSelection(null)}
        onSaveCategory={onSaveCategory}
        onSaveGroup={onSaveGroup}
        onDeleteCategory={onDeleteCategory}
        onDeactivateGroup={onDeactivateGroup}
        onRemoveMemberFromGroup={handleRemoveMember}
        onPermissionChange={onPermissionChange}
        onConfigureExtraction={onConfigureExtraction}
        onStartConnectMode={isAdmin ? startConnectMode : undefined}
        onOpenAddMemberModal={isAdmin ? openAddMemberModal : undefined}
      />

      <AddMemberToGroupDialog
        open={addMemberModal.open}
        onClose={() => setAddMemberModal({ open: false })}
        groups={groups}
        members={members}
        preselectedGroupId={addMemberModal.groupId}
        preselectedMemberId={addMemberModal.memberId}
        onAddMemberToGroup={onAddMemberToGroup}
      />

      <DragOverlay dropAnimation={null}>
        {activeMember ? <UserCardOverlay member={activeMember} /> : null}
        {activeGroup ? <GroupChipOverlay group={activeGroup} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
