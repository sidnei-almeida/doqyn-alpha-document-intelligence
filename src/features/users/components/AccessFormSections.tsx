import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Radio } from '@/components/ui/Radio';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { NotificationPreferencesDto, PlatformRole } from '../api/usersApi';
import { ASSIGNABLE_PLATFORM_ROLES, getPlatformRoleMeta } from '../platformRoleLabels';
import { useTranslation } from 'react-i18next';

export type DocumentGroupOption = {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
};

export function AccessFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'border-t border-doqyn-border-subtle pt-4 first:border-t-0 first:pt-0',
        className,
      )}
    >
      <header className="mb-3">
        <h3 className="register-label text-doqyn-subtle">{title}</h3>
        {description ? <p className="mt-1 text-caption text-doqyn-muted">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function GroupsEmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="border-l-2 border-doqyn-border py-1 pl-3">
      <p className="text-label text-doqyn-text">{title}</p>
      <p className="mt-1 text-caption text-doqyn-muted">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link
          to={ctaHref}
          className="register-label mt-2 inline-flex items-center gap-1 text-doqyn-accent-active underline-offset-4 hover:underline"
        >
          {ctaLabel}
          <Icon name="arrow_forward" size={ICON_SIZE.xs} />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Papel é escolha única, e agora a tela diz isso.
 *
 * Eram caixas de marcar: dava para marcar Administrador e Usuário ao mesmo tempo, ou nenhum dos
 * dois — e nenhum caía em `['user']` dentro de `sanitizeAssignablePlatformRoles`, sem a tela
 * avisar que a escolha tinha sido trocada. Não são somas, são níveis.
 */
export function PlatformRolesSection({
  value,
  onChange,
}: {
  value: PlatformRole[];
  onChange: (roles: PlatformRole[]) => void;
}) {
  const { t } = useTranslation('users');

  // A ordem de `ASSIGNABLE_PLATFORM_ROLES` é a de privilégio: quem é admin é admin, mesmo com
  // `user` também gravado por um caminho antigo.
  const selected = ASSIGNABLE_PLATFORM_ROLES.find((role) => value.includes(role)) ?? 'user';

  return (
    <AccessFormSection
      title={t('accessFormSections.papelNaPlataforma')}
      description={t('accessFormSections.defineOQueA')}
    >
      <div className="divide-y divide-doqyn-border-subtle">
        {ASSIGNABLE_PLATFORM_ROLES.map((role) => {
          const meta = getPlatformRoleMeta(role);
          return (
            <div key={role} className="py-2.5 first:pt-0 last:pb-0">
              <Radio
                name="platform-role"
                value={role}
                checked={selected === role}
                onChange={() => onChange([role])}
                label={meta.label}
                description={meta.description}
              />
            </div>
          );
        })}
      </div>
    </AccessFormSection>
  );
}

export function DocumentGroupsSection({
  groups,
  value,
  onChange,
}: {
  groups: DocumentGroupOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation('users');

  return (
    <AccessFormSection
      title={t('accessFormSections.grupos')}
      description={t('accessFormSections.osMesmosGruposDe')}
    >
      {groups.length === 0 ? (
        <GroupsEmptyState
          title={t('accessFormSections.nenhumGrupoCriadoAinda')}
          description={t('accessFormSections.semGrupoAPessoa')}
          ctaLabel={t('accessFormSections.openRules')}
          ctaHref="/rules"
        />
      ) : (
        <div className="divide-y divide-doqyn-border-subtle">
          {groups.map((group) => {
            const memberCount = group.memberCount ?? 0;

            return (
              <div key={group.id} className="py-2.5 first:pt-0 last:pb-0">
                <Checkbox
                  checked={value.includes(group.id)}
                  onChange={() => {
                    onChange(
                      value.includes(group.id)
                        ? value.filter((id) => id !== group.id)
                        : [...value, group.id],
                    );
                  }}
                  label={
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{group.name}</span>
                      <span className="shrink-0 font-mono text-micro tabular-nums text-doqyn-subtle">
                        {t('accessFormSections.peopleCount', { count: memberCount })}
                      </span>
                    </span>
                  }
                  description={
                    group.description?.trim() || t('accessFormSections.groupFallbackDescription')
                  }
                  wrapperClassName="w-full"
                />
              </div>
            );
          })}
        </div>
      )}
    </AccessFormSection>
  );
}

/** O que avisar. Um evento por linha, com o nome do fato, não do campo. */
const EVENT_OPTIONS: Array<keyof NotificationPreferencesDto> = [
  'documentCreated',
  'documentUpdated',
  'documentRequiresSignature',
  'documentShared',
  'accessApproved',
  'accessRejected',
];

/**
 * Por onde avisar.
 *
 * `reason` preenchido significa canal declarado e ainda sem entrega: a escolha fica gravada e o
 * outbox registra a intenção, mas nada sai enquanto não houver provedor. Dizer isso na tela é o
 * que separa esta caixa de uma promessa — a versão anterior prometia "eventos que este usuário
 * poderá receber futuramente" e não entregava por canal nenhum.
 */
const CHANNEL_OPTIONS: Array<{
  key: keyof NotificationPreferencesDto | 'inApp';
  labelKey?: string;
  reasonKey?: string;
}> = [
  { key: 'inApp' },
  {
    key: 'email',
    labelKey: 'accessFormSections.channels.email',
    reasonKey: 'accessFormSections.channels.emailReason',
  },
  {
    key: 'whatsapp',
    labelKey: 'accessFormSections.channels.whatsapp',
    reasonKey: 'accessFormSections.channels.whatsappReason',
  },
];

export function NotificationsSection({
  value,
  onChange,
}: {
  value: NotificationPreferencesDto;
  onChange: (value: NotificationPreferencesDto) => void;
}) {
  const { t } = useTranslation('users');

  return (
    <AccessFormSection
      title={t('accessFormSections.notificacoes')}
      description={t('accessFormSections.osAvisosSaemDo')}
    >
      <div className="space-y-4">
        <div>
          <p className="text-caption text-doqyn-subtle">{t('accessFormSections.oQueAvisar')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {EVENT_OPTIONS.map((key) => (
              <Checkbox
                key={key}
                checked={value[key]}
                onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
                label={t(`accessFormSections.events.${key}`)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-caption text-doqyn-subtle">{t('accessFormSections.porOnde')}</p>
          <div className="mt-2 space-y-2">
            {CHANNEL_OPTIONS.map((channel) => {
              if (channel.key === 'inApp') {
                return (
                  <Checkbox
                    key="inApp"
                    checked
                    disabled
                    readOnly
                    label={t('accessFormSections.noApp')}
                    description={t('accessFormSections.eACaixaDo')}
                  />
                );
              }

              return (
                <Checkbox
                  key={channel.key}
                  checked={value[channel.key]}
                  onChange={(event) => onChange({ ...value, [channel.key]: event.target.checked })}
                  label={channel.labelKey ? t(channel.labelKey) : channel.key}
                  description={channel.reasonKey ? t(channel.reasonKey) : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>
    </AccessFormSection>
  );
}
