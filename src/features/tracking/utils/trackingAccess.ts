/**
 * Espelho do gate de tracking do servidor, usado só para esconder menu e barrar rota — o gate real
 * é `requireDocumentTrackingAccess`. `doqyn_admin` saiu (D-02): nenhum papel de plataforma acessa
 * dado de cliente, e deixá-lo aqui ofereceria na UI uma ação que o backend agora nega.
 * `individual_admin` fica porque é como o usuário de tenant PF se identifica no frontend, que não
 * tem o contexto de storage usado pelo servidor em `userGovernsTenantScope`.
 */
const TRACKING_ADMIN_ROLES = ['company_admin', 'individual_admin'] as const;

export function canViewDocumentTracking(
  roles: string[],
  _legacyRole?: string,
  membershipStatus?: string,
): boolean {
  const status = membershipStatus?.trim().toLowerCase();
  if (status && status !== 'active') return false;

  // Sem fallback pelo papel legado `admin`/`manager` (D-03): ele vem de dado replicado, não da
  // sessão verificada, e o servidor deixou de honrá-lo.
  return roles.some((role) =>
    TRACKING_ADMIN_ROLES.includes(role as (typeof TRACKING_ADMIN_ROLES)[number]),
  );
}
