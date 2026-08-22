import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/apiErrors';

/**
 * Erro de cliente (4xx) não melhora com insistência: 403 continua 403, 404 continua 404. Repetir
 * só multiplica o ruído no console e a carga no servidor — a tela do app abria com quatro
 * chamadas idênticas a /api/company-members, todas negadas, porque a conta é pessoa física e não
 * tem membros a gerenciar. Erro de rede e falha do servidor seguem com uma segunda tentativa,
 * que é onde repetir de fato ajuda.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
    },
  },
});
