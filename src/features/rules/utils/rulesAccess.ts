export const RULES_ADMIN_ROLES = ['company_admin', 'individual_admin'] as const;

export function canAccessRulesPage(
  hasAnyRole: (roles: readonly string[]) => boolean,
): boolean {
  return hasAnyRole(RULES_ADMIN_ROLES);
}
