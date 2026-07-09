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
      sharedWithUserId: string;
      canDownload?: boolean;
      message?: string;
    }) =>
      createDocumentShare(documentId!, {
        sharedWithUserId: input.sharedWithUserId,
        permissions: { canView: true, canDownload: input.canDownload === true },
        message: input.message,
      }),
    onSuccess: () => toast.success('Documento compartilhado.'),
    onError: (error) => showApiErrorToast(error, 'Não foi possível compartilhar o documento.'),
    onSettled: invalidate,
  });

  const revokeShare = useMutation({
    mutationFn: (shareId: string) => revokeDocumentShare(documentId!, shareId),
    onSuccess: () => toast.success('Compartilhamento revogado.'),
    onError: (error) => showApiErrorToast(error, 'Não foi possível revogar o compartilhamento.'),
    onSettled: invalidate,
  });

  return { shareWithUser, revokeShare };
}
