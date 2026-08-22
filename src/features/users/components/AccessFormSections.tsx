import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';
import type { NotificationPreferencesDto, PlatformRole } from '../api/usersApi';
import {
  ASSIGNABLE_PLATFORM_ROLES,
  getPlatformRoleMeta,
} from '../platformRoleLabels';

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
    <section className={cn('space-y-3 border-t border-doqyn-border-subtle pt-4 first:border-t-0 first:pt-0', className)}>
      <header>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-doqyn-muted">{title}</h3>
        {description ? <p className="mt-1 text-xs text-doqyn-subtle">{description}</p> : null}
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
    <div className="rounded-lg border border-dashed border-doqyn-border bg-doqyn-bg/50 px-4 py-5 text-center">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-doqyn-surface text-doqyn-muted">
        <Icon name="group" size={ICON_SIZE.xs} aria-hidden />
      </div>
      <p className="text-sm text-doqyn-text">{title}</p>
      <p className="mt-1 text-xs text-doqyn-muted">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link
          to={ctaHref}
          className="mt-3 inline-block text-xs font-medium text-doqyn-primary hover:underline"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Não recebe mais um gate de papel global: o papel administrativo de plataforma foi eliminado do
 * produto, então não há checkbox a desabilitar nem aviso de "permissões globais" a exibir. Todo
 * papel listado aqui é atribuível por quem já passou pelo guard de gestão de usuários.
 */
export function PlatformRolesSection({
  value,
  onChange,
}: {
  value: PlatformRole[];
  onChange: (roles: PlatformRole[]) => void;
}) {
  return (
    <AccessFormSection
      title="Roles do sistema"
      description="Defina o nível administrativo deste usuário na plataforma."
    >
      <div className="space-y-2">
        {ASSIGNABLE_PLATFORM_ROLES.map((role) => {
          const meta = getPlatformRoleMeta(role);
          const checked = value.includes(role);

          return (
            <div
              key={role}
              className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2.5"
            >
              <Checkbox
                checked={checked}
                onChange={() => {
                  if (checked) {
                    onChange(value.filter((item) => item !== role));
                  } else {
                    onChange([...value, role]);
                  }
                }}
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
  return (
    <AccessFormSection
      title="Grupos"
      description="Mesmos grupos criados em Regras. Definem o acesso do usuário às categorias de documento."
    >
      {groups.length === 0 ? (
        <GroupsEmptyState
          title="Nenhum grupo criado ainda."
          description="Crie grupos na tela Regras e volte aqui para atribuir membros."
          ctaLabel="Abrir Regras"
          ctaHref="/rules"
        />
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {groups.map((group) => {
            const checked = value.includes(group.id);
            const memberCount = group.memberCount ?? 0;

            return (
              <div
                key={group.id}
                className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2.5"
              >
                <Checkbox
                  checked={checked}
                  onChange={() => {
                    if (checked) {
                      onChange(value.filter((id) => id !== group.id));
                    } else {
                      onChange([...value, group.id]);
                    }
                  }}
                  label={group.name}
                  description={
                    <>
                      {group.description?.trim() || 'Grupo documental de governança'}
                      <span className="mt-1 block text-[10px] text-doqyn-subtle">
                        {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                      </span>
                    </>
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </AccessFormSection>
  );
}

const NOTIFICATION_OPTIONS: Array<[keyof NotificationPreferencesDto, string]> = [
  ['email', 'E-mail'],
  ['whatsapp', 'WhatsApp'],
  ['documentCreated', 'Documento criado'],
  ['documentUpdated', 'Documento atualizado'],
  ['documentRequiresSignature', 'Assinatura necessária'],
  ['accessApproved', 'Acesso aprovado'],
  ['accessRejected', 'Acesso rejeitado'],
];

export function NotificationsSection({
  value,
  onChange,
}: {
  value: NotificationPreferencesDto;
  onChange: (value: NotificationPreferencesDto) => void;
}) {
  return (
    <AccessFormSection
      title="Notificações"
      description="Escolha quais eventos este usuário poderá receber futuramente."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {NOTIFICATION_OPTIONS.map(([key, label]) => (
          <div
            key={key}
            className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2"
          >
            <Checkbox
              checked={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
              label={label}
            />
          </div>
        ))}
      </div>
    </AccessFormSection>
  );
}
