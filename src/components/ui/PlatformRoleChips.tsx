import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { getPlatformRoleLabel } from '@/features/users/platformRoleLabels';
import type { PlatformRole } from '@/features/users/api/usersApi';

type PlatformRoleChipsProps = {
  roles: PlatformRole[];
  className?: string;
};

export function PlatformRoleChips({ roles, className }: PlatformRoleChipsProps) {
  if (!roles.length) {
    return <span className="text-doqyn-muted">—</span>;
  }

  return (
    <div className={className ?? 'flex max-w-[220px] flex-wrap gap-1'}>
      {roles.map((role) => {
        const label = getPlatformRoleLabel(role);
        return (
          <Tooltip key={role} label={role}>
            <Badge
              variant="neutral"
              dot={false}
              className="max-w-full truncate font-medium normal-case tracking-normal"
            >
              {label}
            </Badge>
          </Tooltip>
        );
      })}
    </div>
  );
}
