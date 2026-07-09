import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import {
  createDocumentExternalShare,
  fetchDocumentExternalShares,
  regenerateDocumentExternalShare,
  revokeDocumentExternalShare,
} from '../api/externalShareApi';

export function useDocumentExternalShares(documentId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['document-external-shares', documentId],
    queryFn: () => fetchDocumentExternalShares(documentId!),
    enabled: Boolean(enabled && documentId),
    staleTime: 10_000,
  });
}

export function useExternalShareMutations(documentId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['document-external-shares', documentId] });
    await queryClient.invalidateQueries({ queryKey: ['tracking-events'], refetchType: 'all' });
  };

  const createExternalShare = useMutation({
    mutationFn: (input: {
      recipientEmail: string;
      recipientPhone?: string;
      recipientName?: string;
      recipientOrganizationName?: string;
      canDownload?: boolean;
      expiresAt?: string;
      message?: string;
    }) =>
      createDocumentExternalShare(documentId!, {
        recipientEmail: input.recipientEmail,
        recipientPhone: input.recipientPhone,
        recipientName: input.recipientName,
        recipientOrganizationName: input.recipientOrganizationName,
        permissions: { canView: true, canDownload: input.canDownload === true },
        expiresAt: input.expiresAt,
        message: input.message,
      }),
    onSuccess: (result) => {
      toast.success('Convite externo criado.');
      if (result.inviteUrl) {
        void navigator.clipboard?.writeText(result.inviteUrl).catch(() => undefined);
        toast.message('Link copiado para a área de transferência.');
      }
    },
    onError: (error) => showApiErrorToast(error, 'Não foi possível criar o convite externo.'),
    onSettled: invalidate,
  });

  const revokeExternalShare = useMutation({
    mutationFn: (shareId: string) => revokeDocumentExternalShare(documentId!, shareId),
    onSuccess: () => toast.success('Acesso externo revogado.'),
    onError: (error) => showApiErrorToast(error, 'Não foi possível revogar o acesso externo.'),
    onSettled: invalidate,
  });

  const regenerateExternalShare = useMutation({
    mutationFn: (shareId: string) => regenerateDocumentExternalShare(documentId!, shareId),
    onSuccess: (result) => {
      toast.success('Novo link de convite gerado.');
      if (result.inviteUrl) {
        void navigator.clipboard?.writeText(result.inviteUrl).catch(() => undefined);
        toast.message('Link copiado para a área de transferência.');
      }
    },
    onError: (error) => showApiErrorToast(error, 'Não foi possível renovar o convite externo.'),
    onSettled: invalidate,
  });

  return { createExternalShare, revokeExternalShare, regenerateExternalShare };
}
