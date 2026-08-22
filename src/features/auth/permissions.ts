import type { AuthUser } from './types';

const GLOBAL_ADMIN_ROLE = 'doqyn_admin';
const COMPANY_ADMIN_ROLE = 'company_admin';

/**
 * Espelha `userCanManageUsers` do servidor (`server/auth/memberAuth.ts`).
 *
 * Serve para não pedir o que já se sabe que será negado: uma conta pessoa física não tem
 * membros a gerenciar, e a rota `/api/company-members` responde 403 para ela. Perguntar
 * assim mesmo só rende erro no console e requisição desperdiçada.
 *
 * Não é controle de acesso — quem decide é o servidor. É só evitar a pergunta inútil.
 */
export function userCanManageUsers(user: AuthUser | null | undefined): boolean {
  const roles = user?.roles ?? [];
  return roles.includes(GLOBAL_ADMIN_ROLE) || roles.includes(COMPANY_ADMIN_ROLE);
}
