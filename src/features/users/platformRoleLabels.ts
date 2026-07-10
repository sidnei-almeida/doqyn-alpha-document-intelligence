import type { PlatformRole } from './api/usersApi';

export const ASSIGNABLE_PLATFORM_ROLES: PlatformRole[] = ['doqyn_admin', 'company_admin', 'user'];

export type PlatformRoleMeta = {
  label: string;
  description: string;
};

/** Labels amigáveis para exibição no frontend (valores internos permanecem os slugs do auth). */
export const PLATFORM_ROLE_LABELS: Record<PlatformRole, PlatformRoleMeta> = {
  doqyn_admin: {
    label: 'Administrador do sistema',
    description: 'Acesso administrativo global da plataforma DOQYN.',
  },
  company_admin: {
    label: 'Administrador da empresa',
    description: 'Gerencia usuários, grupos e regras da empresa.',
  },
  individual_admin: {
    label: 'Administrador da conta',
    description: 'Gerencia acesso e documentos da conta individual.',
  },
  user: {
    label: 'Usuário',
    description: 'Acessa documentos e recursos liberados.',
  },
};

/** Ordem de prioridade para exibir o papel principal do usuário. */
export const PLATFORM_ROLE_PRIORITY: PlatformRole[] = [
  'doqyn_admin',
  'company_admin',
  'individual_admin',
  'user',
];

export function getPlatformRoleMeta(role: string): PlatformRoleMeta {
  return (
    PLATFORM_ROLE_LABELS[role as PlatformRole] ?? {
      label: role,
      description: 'Papel da plataforma.',
    }
  );
}

export function getPlatformRoleLabel(role: string): string {
  return getPlatformRoleMeta(role).label;
}

export function resolvePrimaryPlatformRole(roles: string[]): string | null {
  for (const role of PLATFORM_ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? null;
}

export function formatPlatformRoles(roles: PlatformRole[]): string {
  if (!roles.length) return '—';
  return roles.map((role) => getPlatformRoleLabel(role)).join(', ');
}

export function formatPlatformRolesList(roles: string[]): string {
  if (!roles.length) return '—';
  return roles.map((role) => getPlatformRoleLabel(role)).join(', ');
}

/** Labels para o papel legado do AuthUser (`admin`, `manager`, `user`, `viewer`). */
const LEGACY_AUTH_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador do sistema',
  manager: 'Administrador da empresa',
  user: 'Usuário',
  viewer: 'Visualizador',
};

export function getAuthRoleLabel(role: string): string {
  return LEGACY_AUTH_ROLE_LABELS[role] ?? getPlatformRoleLabel(role);
}
