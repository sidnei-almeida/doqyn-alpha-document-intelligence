import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { getActivePermissionShortKeys } from '../../utils/governanceMapUi';

type GovernancePermissionBadgesProps = {
  permissions: DocumentAccessPermissions;
  className?: string;
  emptyLabel?: string;
};

/** Resumo compacto das permissões ativas em uma conexão. */
export function GovernancePermissionBadges({
  permissions,
  className,
  emptyLabel,
}: GovernancePermissionBadgesProps) {
  const { t, i18n } = useTranslation('rules');
  const keys = getActivePermissionShortKeys(permissions);

  if (keys.length === 0) {
    return (
      <span className={cn('text-[10px] text-doqyn-subtle', className)}>
        {emptyLabel ?? t('permission.none')}
      </span>
    );
  }

  // Mesma gramática dos verbos do quadro: rótulo em minúscula, fio de acento no que vale.
  return (
    <div className={cn('permission-verbs', className)}>
      {keys.map((key) => (
        <span key={key} className="permission-verbs__mark" data-active>
          {t(key).toLocaleLowerCase(i18n.language)}
        </span>
      ))}
    </div>
  );
}
