import { cn } from '@/lib/utils';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { getActivePermissionShortLabels } from '../../utils/governanceMapUi';

type GovernancePermissionBadgesProps = {
  permissions: DocumentAccessPermissions;
  className?: string;
  emptyLabel?: string;
};

/** Resumo compacto das permissões ativas em uma conexão. */
export function GovernancePermissionBadges({
  permissions,
  className,
  emptyLabel = 'Sem acesso',
}: GovernancePermissionBadgesProps) {
  const labels = getActivePermissionShortLabels(permissions);

  if (labels.length === 0) {
    return <span className={cn('text-[10px] text-doqyn-subtle', className)}>{emptyLabel}</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full border border-doqyn-border-subtle bg-doqyn-primary-bg px-1.5 py-0.5 text-[10px] font-medium text-doqyn-primary"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
