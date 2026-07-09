import { useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DocumentCategory, Group } from '@/types/rules';

interface GroupsTabProps {
  groups: Group[];
  categories: DocumentCategory[];
  isAdmin: boolean;
  onCreateGroup: () => void;
  onOpenGroup: (group: Group) => void;
}

export function GroupsTab({
  groups,
  categories,
  isAdmin,
  onCreateGroup,
  onOpenGroup,
}: GroupsTabProps) {
  const linkedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groups) {
      counts.set(
        group.id,
        categories.filter((category) => category.accessGroupIds.includes(group.id)).length,
      );
    }
    return counts;
  }, [categories, groups]);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="Nenhum grupo documental cadastrado"
        description="Crie grupos para organizar membros e permissões."
        action={
          isAdmin ? (
            <Button type="button" onClick={onCreateGroup}>
              Novo grupo
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-doqyn-muted">
        Grupos são gerenciados no auth-service. Permissões documentais por classe são salvas no
        app principal.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-doqyn-text">{group.name}</h3>
                {group.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-doqyn-muted">{group.description}</p>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenGroup(group)}>
                <Icon name="edit" size={ICON_SIZE.xs} />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-doqyn-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-doqyn-border-subtle px-2 py-0.5">
                <Icon name="group" size={12} />
                {group.memberCount ?? 0} membros
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-doqyn-border-subtle px-2 py-0.5">
                <Icon name="folder_managed" size={12} />
                {linkedCounts.get(group.id) ?? 0} classes
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
