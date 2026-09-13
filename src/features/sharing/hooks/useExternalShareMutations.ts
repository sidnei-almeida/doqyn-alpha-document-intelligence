import { i18n } from '@/i18n';
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
      recipientLocale?: string;
    }) =>
      createDocumentExternalShare(documentId!, {
        recipientEmail: input.recipientEmail,
        recipientPhone: input.recipientPhone,
        recipientName: input.recipientName,
        recipientOrganizationName: input.recipientOrganizationName,
        permissions: { canView: true, canDownload: input.canDownload === true },
        expiresAt: input.expiresAt,
        message: input.message,
        recipientLocale: input.recipientLocale,
      }),
    onSuccess: () => {
      toast.success(i18n.t('sharing:toast.conviteExternoCriado'));
    },
    onError: (error) => showApiErrorToast(error, i18n.t('sharing:toast.createExternalFailed')),
    onSettled: invalidate,
  });

  const revokeExternalShare = useMutation({
    mutationFn: (shareId: string) => revokeDocumentExternalShare(documentId!, shareId),
    onSuccess: () => toast.success(i18n.t('sharing:toast.acessoExternoRevogado')),
    onError: (error) => showApiErrorToast(error, i18n.t('sharing:toast.revokeExternalFailed')),
    onSettled: invalidate,
  });

  const regenerateExternalShare = useMutation({
    mutationFn: (shareId: string) => regenerateDocumentExternalShare(documentId!, shareId),
    onSuccess: () => {
      toast.success(i18n.t('sharing:toast.novoLinkGerado'));
    },
    onError: (error) => showApiErrorToast(error, i18n.t('sharing:toast.regenerateExternalFailed')),
    onSettled: invalidate,
  });

  return { createExternalShare, revokeExternalShare, regenerateExternalShare };
}
