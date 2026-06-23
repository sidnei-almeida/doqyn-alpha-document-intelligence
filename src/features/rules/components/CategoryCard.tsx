import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import { AssignedGroupBadge } from './AssignedGroupBadge';
import { CategoryIcon } from './categoryIcons';

interface CategoryCardProps {
  category: DocumentCategory;
  groups: Group[];
  onAssign: (categoryId: string, groupId: string) => void;
  onRemove: (categoryId: string, groupId: string) => void;
  onToggleAllNotifications: (categoryId: string, active: boolean) => void;
  onDelete?: (categoryId: string) => void;
  isAdmin?: boolean;
}

export function CategoryCard({
  category,
  groups,
  onAssign,
  onRemove,
  onToggleAllNotifications,
  onDelete,
  isAdmin = true,
}: CategoryCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const assignedGroups = category.accessGroupIds
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => Boolean(g));

  const notificationsActive =
    category.accessGroupIds.length > 0 &&
    category.notifyGroupIds.length === category.accessGroupIds.length;

  const handleDragOver = (e: React.DragEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    setIsDragOver(false);
    const groupId = e.dataTransfer.getData('groupId');
    if (groupId) {
      onAssign(category.id, groupId);
    }
  };

  return (
    <Card className="border-doqyn-border bg-doqyn-surface">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-doqyn-primary-bg">
            <CategoryIcon icon={category.icon} className="h-4 w-4 text-doqyn-primary" />
          </div>
          <CardTitle>{category.name}</CardTitle>
        </div>
        <button
          type="button"
          onClick={() => onDelete?.(category.id)}
          disabled={!onDelete}
          className={cn(
            'rounded p-1.5 text-doqyn-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-primary',
            onDelete && 'hover:bg-doqyn-hover hover:text-doqyn-danger',
            !onDelete && 'invisible',
          )}
          aria-label={`Excluir categoria ${category.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
            Grupos com acesso
          </p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex min-h-[52px] flex-wrap items-center gap-2 rounded-lg border-2 border-dashed p-3 transition-colors',
              isDragOver
                ? 'border-doqyn-primary bg-doqyn-primary-bg'
                : 'border-doqyn-border bg-doqyn-bg/30',
            )}
          >
            {assignedGroups.length === 0 ? (
              <span className="text-sm text-doqyn-muted">Arraste grupos aqui</span>
            ) : (
              assignedGroups.map((group) => (
                <AssignedGroupBadge
                  key={group.id}
                  group={group}
                  onRemove={isAdmin ? () => onRemove(category.id, group.id) : undefined}
                />
              ))
            )}
          </div>
        </div>

        <div className="border-t border-doqyn-border-subtle pt-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
            Notificações
          </p>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={notificationsActive}
              disabled={!isAdmin || category.accessGroupIds.length === 0}
              onChange={(e) => onToggleAllNotifications(category.id, e.target.checked)}
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
}
