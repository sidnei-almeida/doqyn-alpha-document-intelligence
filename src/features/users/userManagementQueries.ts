import type { QueryClient } from '@tanstack/react-query';
import { refetchTenantScopedQueries } from '@/features/tenant/tenantLiveSync';

export function userManagementQueryKeys(tenantId: string) {
  return {
    companyMembers: ['company-members', tenantId] as const,
    authAccessGroups: ['auth-access-groups', tenantId] as const,
    documentGroups: ['document-groups', tenantId] as const,
    auditPending: ['audit-pending', tenantId] as const,
    auditOverview: ['audit-overview', tenantId] as const,
    auditEvents: ['audit-events', tenantId] as const,
  };
}

/** Invalida e refaz fetch de queries de gestão de usuários para o tenant ativo. */
export async function invalidateUserManagementQueries(
  queryClient: QueryClient,
  tenantId?: string,
): Promise<void> {
  const scopedKeys = tenantId
    ? [
        userManagementQueryKeys(tenantId).companyMembers,
        userManagementQueryKeys(tenantId).authAccessGroups,
        userManagementQueryKeys(tenantId).documentGroups,
        userManagementQueryKeys(tenantId).auditPending,
        userManagementQueryKeys(tenantId).auditOverview,
        ['audit-events', tenantId],
      ]
    : [
        ['company-members'],
        ['auth-access-groups'],
        ['document-groups'],
        ['audit-pending'],
        ['audit-overview'],
        ['audit-events'],
        // legado — tela de auditoria usava esta chave antes da correção
        ['access-groups'],
      ];

  await Promise.all(
    scopedKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' }),
    ),
  );

  if (tenantId) {
    await refetchTenantScopedQueries(queryClient, tenantId);
  }
}
