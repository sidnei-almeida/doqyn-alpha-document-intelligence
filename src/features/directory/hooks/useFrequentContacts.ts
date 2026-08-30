import { useQuery } from '@tanstack/react-query';
import { fetchFrequentContacts } from '../api/frequentContactsApi';

/**
 * Com quem esta pessoa já trocou documento, do mais acionado para o menos.
 *
 * Cache mais longo que o da busca: a lista muda quando se envia ou se recebe algo, e não a cada
 * tecla. Recarregá-la a cada abertura de modal gastaria consulta para devolver a mesma ordem.
 */
export function useFrequentContacts(
  scope: 'internal' | 'external' | 'all' = 'all',
  options?: { enabled?: boolean; limit?: number },
) {
  return useQuery({
    queryKey: ['frequent-contacts', scope, options?.limit ?? null],
    queryFn: () => fetchFrequentContacts(scope, options?.limit),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
