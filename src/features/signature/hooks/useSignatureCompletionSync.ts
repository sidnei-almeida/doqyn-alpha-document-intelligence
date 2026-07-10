import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { invalidateSignatureQueries } from '@/features/signature/utils/invalidateSignatureQueries';
import { subscribeSignatureCompleted } from '@/features/signature/utils/signatureCompletionSync';

/** Atualiza biblioteca e listas quando uma assinatura conclui em outra aba (ex.: portal externo). */
export function useSignatureCompletionSync(): void {
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const tenantId = tenant?.tenantId ?? user?.companyId ?? null;

  useEffect(() => {
    return subscribeSignatureCompleted(() => {
      void invalidateSignatureQueries(queryClient, tenantId);
    });
  }, [queryClient, tenantId]);
}
