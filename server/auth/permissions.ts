import type { AuthUser } from './types.js';
import { userHasAnyGroup, userHasRole } from './requireAuth.js';

/** Qualquer usuário autenticado pode solicitar análise experimental. */
export function canAnalyzeDocuments(user: AuthUser): boolean {
  return Boolean(user.id);
}

/** Confirmação exige admin ou grupo com permissão de update na classe. */
export function canConfirmDocuments(
  user: AuthUser,
  updateGroupIds: string[] = [],
): boolean {
  if (userHasRole(user, ['admin', 'manager'])) {
    return true;
  }

  if (!updateGroupIds.length) {
    return true;
  }

  return userHasAnyGroup(user, updateGroupIds);
}
