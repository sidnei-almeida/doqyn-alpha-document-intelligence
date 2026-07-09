import { Icon } from '@/components/ui/Icon';
import { useConfirm } from '@/components/confirm/useConfirm';
import { Button } from '@/components/ui/Button';
import {
  buildRejectApprovalConfirm,
  buildRemoveMemberConfirm,
  buildSuspendMemberConfirm,
} from '@/components/confirm/confirmMessages';
import { cn } from '@/lib/utils';
import type { CompanyMember, Group, MemberStatus } from '@/types/rules';
import { GROUP_COLOR_STYLES } from '@/utils/rulesHelpers';
import { MemberRoleBadge } from './MemberRoleBadge';
import { MemberStatusBadge } from './MemberStatusBadge';

interface MembersTableProps {
  members: CompanyMember[];
  groups: Group[];
  selectedMemberId?: string;
  isAdmin: boolean;
  onSelect: (member: CompanyMember) => void;
  onEditGroups: (member: CompanyMember) => void;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
  onSuspend: (memberId: string) => void;
  onRemove: (memberId: string) => void;
}

export function MembersTable({
  members,
  groups,
  selectedMemberId,
  isAdmin,
  onSelect,
  onEditGroups,
  onApprove,
  onReject,
  onSuspend,
  onRemove,
}: MembersTableProps) {
  const confirm = useConfirm();

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-doqyn-border bg-doqyn-surface px-6 py-12 text-center text-sm text-doqyn-muted">
        Nenhum membro encontrado com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-doqyn-border bg-doqyn-surface">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-doqyn-border">
            {['Nome', 'E-mail', 'Cargo', 'Grupos', 'Perfil', 'Status', 'Último acesso', 'Ações'].map(
              (header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-xs font-medium text-doqyn-muted whitespace-nowrap"
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const memberGroups = member.groupIds
              .map((id) => groups.find((g) => g.id === id))
              .filter((g): g is Group => Boolean(g));

            return (
              <tr
                key={member.id}
                onClick={() => onSelect(member)}
                className={cn(
                  'cursor-pointer border-b border-doqyn-border-subtle transition-colors last:border-0 hover:bg-doqyn-hover',
                  selectedMemberId === member.id && 'bg-doqyn-primary-bg',
                )}
              >
                <td className="px-4 py-3 font-medium text-doqyn-text whitespace-nowrap">
                  {member.name}
                </td>
                <td className="px-4 py-3 text-doqyn-muted whitespace-nowrap">{member.email}</td>
                <td className="px-4 py-3 text-doqyn-muted whitespace-nowrap">
                  {member.position ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {memberGroups.map((group) => {
                      const styles = GROUP_COLOR_STYLES[group.color];
                      return (
                        <span
                          key={group.id}
                          className={cn(
                            'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                            styles.badge,
                          )}
                        >
                          {group.name}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <MemberRoleBadge role={member.role} />
                </td>
                <td className="px-4 py-3">
                  <MemberStatusBadge status={member.status} />
                </td>
                <td className="px-4 py-3 text-doqyn-muted whitespace-nowrap">
                  {member.lastAccessAt ?? 'Nunca'}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <MemberActions
                    member={member}
                    isAdmin={isAdmin}
                    onView={() => onSelect(member)}
                    onEditGroups={() => onEditGroups(member)}
                    onApprove={() => onApprove(member.id)}
                    onReject={async () => {
                      const ok = await confirm(buildRejectApprovalConfirm(member.name));
                      if (ok) onReject(member.id);
                    }}
                    onSuspend={async () => {
                      const ok = await confirm(buildSuspendMemberConfirm(member.name));
                      if (ok) onSuspend(member.id);
                    }}
                    onRemove={async () => {
                      const ok = await confirm(buildRemoveMemberConfirm(member.name));
                      if (ok) onRemove(member.id);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MemberActions({
  member,
  isAdmin,
  onView,
  onEditGroups,
  onApprove,
  onReject,
  onSuspend,
  onRemove,
}: {
  member: CompanyMember;
  isAdmin: boolean;
  onView: () => void;
  onEditGroups: () => void;
  onApprove: () => void;
  onReject: () => void | Promise<void>;
  onSuspend: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  if (!isAdmin) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={onView} className="h-7 px-2">
        <Icon name="visibility" size={14} />
      </Button>
    );
  }

  if (member.status === 'pending') {
    return (
      <div className="flex gap-1">
        <Button type="button" size="sm" onClick={onApprove} className="h-7 px-2">
          <Icon name="check" size={14} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void onReject()}
          className="h-7 px-2 border-doqyn-border"
        >
          <Icon name="person_remove" size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onView} className="h-7 px-2">
        <Icon name="visibility" size={14} />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onEditGroups} className="h-7 px-2">
        <Icon name="edit" size={14} />
      </Button>
      {member.status === 'active' && (
        <Button type="button" variant="ghost" size="sm" onClick={() => void onSuspend()} className="h-7 px-2 text-doqyn-warning">
          <Icon name="more_horiz" size={14} />
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={() => void onRemove()} className="h-7 px-2 text-doqyn-danger">
        <Icon name="person_remove" size={14} />
      </Button>
    </div>
  );
}

export type MemberStatusFilter = MemberStatus | 'all';

export type MemberGroupFilter = string | 'all';
