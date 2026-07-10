import { RULES_ADMIN_ROLES } from '@/features/rules/utils/rulesAccess';

/** Administradores de documentos podem confirmar metadados, excluir e renomear. */
export function canConfirmDocumentMetadata(
  hasAnyRole: (roles: readonly string[]) => boolean,
): boolean {
  return hasAnyRole(RULES_ADMIN_ROLES);
}
