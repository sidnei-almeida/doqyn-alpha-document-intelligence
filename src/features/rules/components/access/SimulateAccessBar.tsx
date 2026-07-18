import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { CompanyMember, Group } from '@/types/rules';
import { describeMemberGroups } from './accessModel';

type SimulateAccessSelectProps = {
  members: CompanyMember[];
  activeMemberId: string;
  onChange: (memberId: string) => void;
};

/** Seletor "Ver como" — simula a visão de qualquer pessoa da empresa. */
export function SimulateAccessSelect({
  members,
  activeMemberId,
  onChange,
}: SimulateAccessSelectProps) {
  return (
    <ToolbarSelect
      icon="visibility"
      label="Ver como"
      value={activeMemberId}
      defaultValue=""
      onChange={onChange}
      options={[
        { value: '', label: 'Ninguém (visão de admin)' },
        ...members.map((member) => ({ value: member.id, label: member.name })),
      ]}
    />
  );
}

type SimulateAccessBannerProps = {
  member: CompanyMember;
  groups: Group[];
  onExit: () => void;
};

export function SimulateAccessBanner({ member, groups, onExit }: SimulateAccessBannerProps) {
  return (
    <div className="menu-enter flex items-center gap-2.5 rounded-lg border border-doqyn-sidebar-selected-border bg-doqyn-sidebar-selected px-3.5 py-2.5">
      <UserAvatar userId={member.userId} name={member.name} email={member.email} size="sm" />
      <p className="type-body min-w-0 flex-1 text-doqyn-text">
        Vendo como <strong className="font-medium">{member.name}</strong> —{' '}
        {describeMemberGroups(member, groups)}
      </p>
      <button
        type="button"
        onClick={onExit}
        className="shrink-0 rounded-md px-2 py-1 font-display text-label font-medium text-doqyn-primary hover:bg-doqyn-surface-hover"
      >
        Sair da simulação
      </button>
    </div>
  );
}
