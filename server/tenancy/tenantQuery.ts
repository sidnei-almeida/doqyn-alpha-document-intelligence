/** Filtro de partição lógica — compatível com registros legados que usam companyId. */
export function tenantScopeFilter(tenantId: string): Record<string, unknown> {
  return {
    $or: [{ tenantId }, { companyId: tenantId }],
  };
}

export function withTenantFields<T extends Record<string, unknown>>(
  tenantId: string,
  doc: T,
  ownerUserId?: string,
): T & { tenantId: string; companyId: string; ownerUserId?: string } {
  return {
    ...doc,
    tenantId,
    companyId: tenantId,
    ...(ownerUserId ? { ownerUserId } : {}),
  };
}
