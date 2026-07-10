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
import { Icon } from '@/components/ui/Icon';
import { useConfirm } from '@/components/confirm/useConfirm';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  buildDeleteCategoryConfirm,
  buildDeleteGroupConfirm,
  buildRemoveGroupFromCategoryConfirm,
} from '@/components/confirm/confirmMessages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/Tabs';
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
  onConfigureExtraction?: (category: DocumentCategory) => void;
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
  onConfigureExtraction,
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
      <div className="space-y-6">
        <section>
          <SectionHeader
            title="Grupos disponíveis"
            description="Arraste um grupo para uma categoria abaixo para conceder acesso aos documentos."
          />
          <Card className="border-doqyn-border bg-doqyn-surface">
            <CardContent className="p-4">
              {groups.length === 0 ? (
                <p className="text-sm text-doqyn-muted">Nenhum grupo cadastrado.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
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
                          <Icon name="delete" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Categorias de documentos"
            description="Cada categoria define quais grupos podem visualizar e receber notificações."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {categories.map((category) => {
              const assignedGroups = category.documentGroupIds
                .map((id) => groups.find((g) => g.id === id))
                .filter((g): g is Group => Boolean(g));

              const notificationsActive = category.notifyOnUpdate;

              return (
                <Card key={category.id} className="border-doqyn-border bg-doqyn-surface">
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-doqyn-primary-bg">
                        <CategoryIcon icon={category.icon} className="h-4 w-4 text-doqyn-primary" />
                      </div>
                      <CardTitle>{category.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {onConfigureExtraction && (
                        <button
                          type="button"
                          onClick={() => onConfigureExtraction(category)}
                          className="rounded px-2 py-1 text-xs font-medium text-doqyn-primary hover:bg-doqyn-primary-bg"
                        >
                          Campos da análise
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCategory(category)}
                          className="rounded p-1.5 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-danger"
                          aria-label={`Excluir categoria ${category.name}`}
                        >
                          <Icon name="delete" size={16} aria-hidden />
                        </button>
                      )}
                    </div>
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
                        Membros desses grupos terão acesso aos documentos desta categoria.
                      </p>
                    </div>

                    <div className="border-t border-doqyn-border-subtle pt-4">
                      <Checkbox
                        checked={notificationsActive}
                        disabled={!isAdmin || category.documentGroupIds.length === 0}
                        onChange={(e) => onToggleNotifications(category.id, e.target.checked)}
                        label="Notificar membros sobre atualizações"
                        wrapperClassName={cn(!isAdmin && 'cursor-default opacity-70')}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeGroup ? <GroupChipOverlay group={activeGroup} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
