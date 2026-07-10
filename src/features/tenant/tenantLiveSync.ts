import type { QueryClient } from '@tanstack/react-query';

/** Intervalo padrão para manter listas do tenant atualizadas sem F5. */
export const TENANT_LIVE_SYNC_INTERVAL_MS = 20_000;

export function tenantLiveSyncQueryOptions() {
  return {
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: TENANT_LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: false,
  } as const;
}

function tenantScopedQueryKeys(tenantId: string): readonly (readonly unknown[])[] {
  return [
    ['company-members', tenantId],
    ['document-groups', tenantId],
    ['auth-access-groups', tenantId],
    ['audit-overview', tenantId],
    ['audit-pending', tenantId],
    ['audit-events', tenantId],
    ['documents', tenantId],
    ['dashboard-overview', tenantId],
    ['trash-documents', tenantId],
    ['document-categories-options'],
    ['favorite-documents'],
    ['shared-with-me'],
    ['tracking-events'],
    ['tracking-summary'],
    ['assigned-signature-requests'],
  ];
}

/** Refaz fetch das queries ativas do tenant (usuários, auditoria, biblioteca, etc.). */
export async function refetchTenantScopedQueries(
  queryClient: QueryClient,
  tenantId: string,
): Promise<void> {
  if (!tenantId.trim()) return;

  await Promise.allSettled(
    tenantScopedQueryKeys(tenantId).map((queryKey) =>
      queryClient.refetchQueries({ queryKey, type: 'active' }),
    ),
  );
}
