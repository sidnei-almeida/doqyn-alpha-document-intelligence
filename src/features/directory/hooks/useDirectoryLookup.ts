import { useQuery } from '@tanstack/react-query';
import { lookupDirectoryTarget } from '../api/directoryApi';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}

/**
 * Só pergunta quando a busca dentro de casa já falhou.
 *
 * A consulta tem teto por quem consulta no servidor, e disparar a cada tecla queimaria a cota de
 * quem está apenas digitando. Daí as duas condições: o texto já é um e-mail inteiro, e a lista de
 * membros voltou vazia — quer dizer, o caminho de dentro da empresa não resolveu.
 */
export function useDirectoryLookup(email: string, enabled: boolean) {
  const normalized = email.trim().toLowerCase();
  const valid = looksLikeEmail(normalized);

  return useQuery({
    queryKey: ['directory-lookup', normalized],
    queryFn: () => lookupDirectoryTarget(normalized),
    enabled: enabled && valid,
    staleTime: 60_000,
    retry: false,
  });
}
