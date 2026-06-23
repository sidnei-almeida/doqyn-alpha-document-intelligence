import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/confirm/ConfirmProvider';
import { buildDeleteGroupConfirm, buildRemoveFromGroupConfirm } from '@/components/confirm/confirmMessages';
import { cn } from '@/lib/utils';
import type { CompanyMember, Group } from '@/types/rules';
import { GROUP_COLOR_STYLES } from '@/utils/rulesHelpers';
import { AVAILABLE_DROP_ID } from '../dnd/types';
import { DropZone } from './DropZone';
import { UserCard } from './UserCard';

interface AvailableUsersColumnProps {
  members: CompanyMember[];
  groups: Group[];
  selectedMemberId?: string;
  isAdmin: boolean;
  onSelectMember: (member: CompanyMember) => void;
}

export function AvailableUsersColumn({
  members,
  groups,
  selectedMemberId,
  isAdmin,
  onSelectMember,
}: AvailableUsersColumnProps) {
  const availableMembers = members.filter(
    (m) => m.status === 'active' && m.groupIds.length === 0,
  );

  return (
    <div className="flex w-[220px] shrink-0 flex-col">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-doqyn-text">Usuários disponíveis</h3>
        <p className="text-[11px] text-doqyn-muted">Arraste para um grupo abaixo</p>
      </div>
      <DropZone
        id={AVAILABLE_DROP_ID}
        disabled={!isAdmin}
        isEmpty={availableMembers.length === 0}
        emptyHint="Nenhum usuário sem grupo"
        className="flex-1 space-y-2"
        activeClassName="border-doqyn-primary"
      >
        {availableMembers.map((member) => (
          <UserCard
            key={member.id}
            member={member}
            sourceGroupId={null}
            groups={groups}
            isSelected={selectedMemberId === member.id}
            isAdmin={isAdmin}
            onSelect={() => onSelectMember(member)}
          />
        ))}
      </DropZone>
    </div>
  );
}

interface GroupColumnProps {
  group: Group;
  members: CompanyMember[];
  allGroups: Group[];
  memberCount: number;
  selectedMemberId?: string;
  isAdmin: boolean;
  onSelectMember: (member: CompanyMember) => void;
  onRemoveMember: (memberId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export function GroupColumn({
  group,
  members,
  allGroups,
  memberCount,
  selectedMemberId,
  isAdmin,
  onSelectMember,
  onRemoveMember,
  onDeleteGroup,
}: GroupColumnProps) {
  const confirm = useConfirm();
  const styles = GROUP_COLOR_STYLES[group.color];
  const groupMembers = members.filter(
    (m) => m.status === 'active' && m.groupIds.includes(group.id),
  );

  const handleRemoveMember = async (member: CompanyMember) => {
    const ok = await confirm(buildRemoveFromGroupConfirm(member.name, group.name));
    if (ok) onRemoveMember(member.id);
  };

  const handleDeleteGroup = async () => {
    if (!onDeleteGroup) return;
    const ok = await confirm(buildDeleteGroupConfirm(group.name, memberCount));
    if (ok) onDeleteGroup(group.id);
  };

  return (
    <div className="flex w-[200px] shrink-0 flex-col">
      <div className={cn('mb-2 rounded-lg border px-3 py-2', styles.border, 'border-doqyn-border bg-doqyn-surface')}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-doqyn-text">{group.name}</h3>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-doqyn-muted">
              {memberCount}
            </span>
            {isAdmin && onDeleteGroup && (
              <button
                type="button"
                onClick={() => void handleDeleteGroup()}
                className="rounded p-0.5 text-doqyn-muted hover:text-doqyn-danger"
                aria-label={`Excluir grupo ${group.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-doqyn-muted">
          {memberCount === 1 ? '1 membro' : `${memberCount} membros`}
        </p>
      </div>
      <DropZone
        id={`group-${group.id}`}
        disabled={!isAdmin}
        isEmpty={groupMembers.length === 0}
        emptyHint="Arraste usuários aqui"
        className="min-h-[200px] flex-1 space-y-2"
      >
        {groupMembers.map((member) => (
          <UserCard
            key={`${group.id}-${member.id}`}
            member={member}
            sourceGroupId={group.id}
            groups={allGroups}
            isSelected={selectedMemberId === member.id}
            isAdmin={isAdmin}
            onSelect={() => onSelectMember(member)}
            onRemoveFromGroup={
              isAdmin ? () => void handleRemoveMember(member) : undefined
            }
            compact
          />
        ))}
      </DropZone>
    </div>
  );
}
