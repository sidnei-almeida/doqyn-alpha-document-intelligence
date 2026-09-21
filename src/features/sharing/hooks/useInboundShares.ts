import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { i18n } from '@/i18n';
import { decideInboundShare, fetchInboundShares } from '../api/inboundSharesApi';

export const INBOUND_SHARES_QUERY_KEY = ['inbound-shares'] as const;

export function useInboundShares(enabled = true) {
  return useQuery({
    queryKey: INBOUND_SHARES_QUERY_KEY,
    queryFn: fetchInboundShares,
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Aceitar muda o que a Biblioteca mostra, e recusar também.
 *
 * Por isso as duas invalidam a lista de compartilhados junto com a caixa: aceitar sem invalidar
 * deixaria o documento liberado no servidor e invisível na tela até alguém recarregar — o pior dos
 * dois mundos, porque parece que o aceite não funcionou.
 */
export function useInboundShareDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ grantId, decision }: { grantId: string; decision: 'accept' | 'decline' }) =>
      decideInboundShare(grantId, decision),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === 'accept'
          ? i18n.t('sharing:toast.inboundAccepted', {
              section: i18n.t('common:nav.compartilhados'),
            })
          : i18n.t('sharing:toast.inboundDeclined'),
      );
      await queryClient.invalidateQueries({ queryKey: INBOUND_SHARES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['shared-with-me'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : i18n.t('sharing:toast.decisionFailed'));
    },
  });
}
