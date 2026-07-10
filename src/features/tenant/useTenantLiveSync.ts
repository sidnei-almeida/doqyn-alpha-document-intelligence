import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import {
  refetchTenantScopedQueries,
  TENANT_LIVE_SYNC_INTERVAL_MS,
} from './tenantLiveSync';

/**
 * Mantém dados do tenant sincronizados enquanto o workspace está aberto:
 * polling leve + refetch ao voltar para a aba.
 */
export function useTenantLiveSync(): void {
  const { isAuthenticated, tenant, user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.tenantId ?? user?.companyId ?? '';
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;

    const sync = async () => {
      if (syncingRef.current || document.visibilityState !== 'visible') return;
      syncingRef.current = true;
      try {
        await refetchTenantScopedQueries(queryClient, tenantId);
      } finally {
        syncingRef.current = false;
      }
    };

    void sync();

    const intervalId = window.setInterval(() => {
      void sync();
    }, TENANT_LIVE_SYNC_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void sync();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isAuthenticated, queryClient, tenantId]);
}
