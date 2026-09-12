import { Button } from '@/components/ui/Button';
import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { CompanyMember, Group } from '@/types/rules';
import { describeMemberGroups } from './accessModel';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('rules');

  return (
    <ToolbarSelect
      icon="visibility"
      label={t('simulateAccessBar.verComo')}
      value={activeMemberId}
      defaultValue=""
      onChange={onChange}
      options={[
        { value: '', label: t('simulateAccessBar.nobody') },
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
  const { t } = useTranslation('rules');

  return (
    <div className="rules-simulation">
      <UserAvatar userId={member.userId} name={member.name} email={member.email} size="sm" />
      <p className="type-body min-w-0 flex-1 text-doqyn-text">
        {t('simulateAccessBar.vendoComo')} <strong className="font-medium">{member.name}</strong>:{' '}
        {describeMemberGroups(member, groups)}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onExit} className="shrink-0">
        {t('simulateAccessBar.sairDaSimulacao')}
      </Button>
    </div>
  );
}
