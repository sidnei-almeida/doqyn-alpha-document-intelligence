import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/confirm/ConfirmProvider';
import {
  buildDeleteCategoryConfirm,
  buildDeleteGroupConfirm,
  buildRemoveGroupFromCategoryConfirm,
} from '@/components/confirm/confirmMessages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import { categoryDropId, type GroupDragData, parseCategoryDropId } from '../dnd/types';
import { CategoryIcon } from './categoryIcons';
import { DraggableGroupChip, GroupChipOverlay } from './DraggableGroupChip';
import { DropZone } from './DropZone';

interface CategoryAccessBoardProps {
  categories: DocumentCategory[];
  groups: Group[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onAssign: (categoryId: string, groupId: string) => void;
  onRemove: (categoryId: string, groupId: string) => void;
  onToggleNotifications: (categoryId: string, active: boolean) => void;
  onDelete?: (categoryId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export function CategoryAccessBoard({
  categories,
  groups,
  groupMemberCounts,
  isAdmin,
  onAssign,
  onRemove,
  onToggleNotifications,
  onDelete,
  onDeleteGroup,
}: CategoryAccessBoardProps) {
  const confirm = useConfirm();
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDeleteCategory = async (category: DocumentCategory) => {
    if (!onDelete) return;
    const ok = await confirm(buildDeleteCategoryConfirm(category.name));
    if (ok) onDelete(category.id);
  };

  const handleRemoveGroupFromCategory = async (
    category: DocumentCategory,
    group: Group,
  ) => {
    const ok = await confirm(
      buildRemoveGroupFromCategoryConfirm(group.name, category.name),
    );
    if (ok) onRemove(category.id, group.id);
  };

  const handleDeleteGroup = async (group: Group) => {
    if (!onDeleteGroup) return;
    const count = groupMemberCounts[group.id] ?? 0;
    const ok = await confirm(buildDeleteGroupConfirm(group.name, count));
    if (ok) onDeleteGroup(group.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as GroupDragData | undefined;
    if (data?.type === 'group') {
      const group = groups.find((g) => g.id === data.groupId);
      if (group) setActiveGroup(group);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGroup(null);

    const { active, over } = event;
    if (!over || !isAdmin) return;

    const data = active.data.current as GroupDragData | undefined;
    if (data?.type !== 'group') return;

    const categoryId = parseCategoryDropId(String(over.id));
    if (categoryId) {
      onAssign(categoryId, data.groupId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid items-start gap-4 min-[1280px]:grid-cols-[220px_1fr]">
        <Card className="sticky top-4 border-doqyn-border bg-doqyn-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Grupos</CardTitle>
            <p className="text-xs text-doqyn-muted">Arraste para as categorias</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center gap-1">
                <DraggableGroupChip group={group} isAdmin={isAdmin} />
                {isAdmin && onDeleteGroup && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteGroup(group)}
                    className="shrink-0 rounded p-1 text-doqyn-muted hover:text-doqyn-danger"
                    aria-label={`Excluir grupo ${group.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {categories.map((category) => {
            const assignedGroups = category.accessGroupIds
              .map((id) => groups.find((g) => g.id === id))
              .filter((g): g is Group => Boolean(g));

            const notificationsActive =
              category.accessGroupIds.length > 0 &&
              category.notifyGroupIds.length === category.accessGroupIds.length;

            return (
              <Card key={category.id} className="border-doqyn-border bg-doqyn-surface">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-doqyn-primary-bg">
                      <CategoryIcon icon={category.icon} className="h-4 w-4 text-doqyn-primary" />
                    </div>
                    <CardTitle>{category.name}</CardTitle>
                  </div>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteCategory(category)}
                      className="rounded p-1.5 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-danger"
                      aria-label={`Excluir categoria ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                      Grupos com acesso
                    </p>
                    <DropZone
                      id={categoryDropId(category.id)}
                      disabled={!isAdmin}
                      dropHint="Solte para adicionar à categoria"
                      isEmpty={assignedGroups.length === 0}
                      emptyHint="Arraste grupos aqui"
                      className="flex min-h-[56px] flex-wrap items-center gap-2"
                    >
                      {assignedGroups.map((group) => (
                        <DraggableGroupChip
                          key={group.id}
                          group={group}
                          isAdmin={false}
                          showGrip={false}
                          onRemove={
                            isAdmin
                              ? () => void handleRemoveGroupFromCategory(category, group)
                              : undefined
                          }
                        />
                      ))}
                    </DropZone>
                    <p className="mt-2 text-xs text-doqyn-muted">
                      Todos os membros desses grupos terão acesso aos documentos desta categoria.
                    </p>
                  </div>

                  <div className="border-t border-doqyn-border-subtle pt-4">
                    <label
                      className={cn(
                        'flex items-center gap-3',
                        isAdmin ? 'cursor-pointer' : 'cursor-default opacity-70',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={notificationsActive}
                        disabled={!isAdmin || category.accessGroupIds.length === 0}
                        onChange={(e) => onToggleNotifications(category.id, e.target.checked)}
                        className="h-4 w-4 rounded border-doqyn-border-strong bg-doqyn-bg accent-doqyn-action disabled:opacity-40"
                      />
                      <span className="text-sm text-doqyn-text">
                        Notificar membros desses grupos sobre atualizações
                      </span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeGroup ? <GroupChipOverlay group={activeGroup} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
