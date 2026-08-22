import { useQuery } from '@tanstack/react-query';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import { useAuth } from '@/features/auth/useAuth';
import { userCanManageUsers } from '@/features/auth/permissions';
import { usersApi } from '../api/usersApi';

export function useCompanyMembers(tenantId: string) {
  const { user } = useAuth();

  // Conta pessoa física não gerencia membros, e a rota devolve 403 para ela. Entrar no app
  // disparava a chamada assim mesmo, em toda tela que usa este hook.
  const canManageUsers = userCanManageUsers(user);

  return useQuery({
    queryKey: ['company-members', tenantId],
    queryFn: () => usersApi.list(),
    enabled: Boolean(tenantId) && canManageUsers,
    ...tenantLiveSyncQueryOptions(),
  });
}
