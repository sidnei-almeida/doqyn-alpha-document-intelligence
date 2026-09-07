import { useQuery } from '@tanstack/react-query';
import { fetchPartnerTenants } from '../api/partnersApi';

/**
 * As empresas com quem já se trocou documento.
 *
 * Cache longo de propósito: o histórico muda quando alguém aceita algo, não a cada abertura de
 * formulário, e refazer a varredura por documento a cada foco de janela pagaria caro por um dado
 * que quase nunca muda.
 */
export function usePartnerTenants(enabled = true) {
  return useQuery({
    queryKey: ['directory-partners'],
    queryFn: fetchPartnerTenants,
    enabled,
    staleTime: 10 * 60_000,
  });
}
