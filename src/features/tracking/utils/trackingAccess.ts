const TRACKING_ADMIN_ROLES = ['doqyn_admin', 'company_admin', 'individual_admin'] as const;

export function canViewDocumentTracking(
  roles: string[],
  legacyRole?: string,
  membershipStatus?: string,
): boolean {
  const status = membershipStatus?.trim().toLowerCase();
  if (status && status !== 'active') return false;

  if (roles.some((role) => TRACKING_ADMIN_ROLES.includes(role as (typeof TRACKING_ADMIN_ROLES)[number]))) {
    return true;
  }

  return legacyRole === 'admin' || legacyRole === 'manager';
}
