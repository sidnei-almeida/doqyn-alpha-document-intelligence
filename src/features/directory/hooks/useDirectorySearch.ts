import { useQuery } from '@tanstack/react-query';
import { searchDirectoryUsers } from '../api/directorySearchApi';

/**
 * Busca digitável entre empresas, por apelido.
 *
 * A partir de dois caracteres, e não de um: um prefixo de uma letra devolveria um pedaço grande do
 * diretório a cada tecla, e o servidor recusa de qualquer forma. O cache por termo evita repetir a
 * mesma consulta quando a pessoa apaga uma letra e a digita de novo — e cada consulta gasta a
 * mesma cota do lookup por e-mail.
 */
export function useDirectorySearch(query: string, enabled = true) {
  const prefix = query.trim().toLowerCase().replace(/^@/, '');

  return useQuery({
    queryKey: ['directory-search', prefix],
    queryFn: () => searchDirectoryUsers(prefix),
    enabled: enabled && prefix.length >= 2,
    staleTime: 60_000,
    retry: false,
  });
}
