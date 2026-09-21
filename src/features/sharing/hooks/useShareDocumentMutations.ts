import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import {
  createDocumentShare,
  fetchDocumentShares,
  revokeDocumentShare,
  searchShareableUsers,
} from '../api/shareApi';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';
import { i18n } from '@/i18n';

export function useDocumentShares(documentId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['document-shares', documentId],
    queryFn: () => fetchDocumentShares(documentId!),
    enabled: Boolean(enabled && documentId),
    staleTime: 10_000,
  });
}

export function useShareableUsersSearch(documentId: string | null, query: string) {
  return useQuery({
    queryKey: ['shareable-users', documentId, query],
    queryFn: () => searchShareableUsers(query, documentId ?? undefined),
    enabled: Boolean(documentId),
    staleTime: 5_000,
  });
}

export function useShareDocumentMutations(documentId: string | null) {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] });
    await queryClient.invalidateQueries({ queryKey: ['shared-with-me'] });
    await queryClient.invalidateQueries({ queryKey: ['shareable-users'] });
    await queryClient.invalidateQueries({ queryKey: ['document-detail'], refetchType: 'all' });
    await queryClient.invalidateQueries({ queryKey: ['tracking-events'], refetchType: 'all' });
    await invalidateLibraryQueries(queryClient, tenant?.tenantId);
  };

  const shareWithUser = useMutation({
    mutationFn: (input: {
      sharedWithUserId?: string;
      sharedWithEmail?: string;
      sharedWithUsername?: string;
      canDownload?: boolean;
      message?: string;
      expiresAt?: string;
    }) =>
      createDocumentShare(documentId!, {
        sharedWithUserId: input.sharedWithUserId,
        sharedWithEmail: input.sharedWithEmail,
        sharedWithUsername: input.sharedWithUsername,
        permissions: { canView: true, canDownload: input.canDownload === true },
        message: input.message,
        expiresAt: input.expiresAt,
      }),
    onSuccess: (_result, input) =>
      toast.success(
        input.sharedWithEmail || input.sharedWithUsername
          ? i18n.t('sharing:toast.sentPendingAcceptance')
          : i18n.t('sharing:toast.documentShared'),
      ),
    onError: (error) => showApiErrorToast(error, i18n.t('sharing:toast.shareFailed')),
    onSettled: invalidate,
  });

  const revokeShare = useMutation({
    mutationFn: (shareId: string) => revokeDocumentShare(documentId!, shareId),
    onSuccess: () => toast.success(i18n.t('sharing:toast.compartilhamentoRevogado')),
    onError: (error) => showApiErrorToast(error, i18n.t('sharing:toast.revokeShareFailed')),
    onSettled: invalidate,
  });

  return { shareWithUser, revokeShare };
}
