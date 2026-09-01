import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import { fetchTenantUsage } from '../api/tenantUsageApi';

/**
 * Uso do tenant para o rodapé da barra lateral.
 *
 * O número acompanha o mesmo sincronismo do resto do workspace, mas não é dado
 * de decisão: um upload que ainda não apareceu ali não muda o que a pessoa faz
 * a seguir. Por isso a consulta não roda ao voltar para a aba nem a cada troca
 * de rota — ela envelhece um minuto em silêncio.
 */
export function useTenantUsage() {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['tenant-usage', tenant?.tenantId],
    queryFn: fetchTenantUsage,
    ...tenantLiveSyncQueryOptions(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
