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

  // Mesma gramática dos verbos do quadro: rótulo em minúscula, fio de acento no que vale.
  return (
    <div className={cn('permission-verbs', className)}>
      {labels.map((label) => (
        <span key={label} className="permission-verbs__mark" data-active>
          {label.toLocaleLowerCase('pt-BR')}
        </span>
      ))}
    </div>
  );
}
