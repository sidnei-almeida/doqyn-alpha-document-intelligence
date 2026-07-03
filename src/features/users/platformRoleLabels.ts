import type { PlatformRole } from './api/usersApi';

export const ASSIGNABLE_PLATFORM_ROLES: PlatformRole[] = ['doqyn_admin', 'company_admin', 'user'];

export type PlatformRoleMeta = {
  label: string;
  description: string;
};

export const PLATFORM_ROLE_LABELS: Record<
  Extract<PlatformRole, 'doqyn_admin' | 'company_admin' | 'user'>,
  PlatformRoleMeta
> = {
  doqyn_admin: {
    label: 'Administrador DOQYN',
    description: 'Acesso administrativo global da plataforma.',
  },
  company_admin: {
    label: 'Administrador da empresa',
    description: 'Gerencia usuários, grupos e regras da empresa.',
  },
  user: {
    label: 'Usuário',
    description: 'Acessa documentos e recursos liberados.',
  },
};

export function formatPlatformRoles(roles: PlatformRole[]): string {
  if (!roles.length) return '—';
  return roles
    .map((role) => PLATFORM_ROLE_LABELS[role as keyof typeof PLATFORM_ROLE_LABELS]?.label ?? role)
    .join(', ');
}
