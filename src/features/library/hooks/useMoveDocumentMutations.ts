import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import {
  batchMoveDocumentsToCategory,
  moveDocumentToCategory,
} from '../api/moveApi';
import { invalidateLibraryQueries } from '../utils/libraryQueryInvalidation';

export function useMoveDocumentMutations() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const invalidate = async () => {
    await invalidateLibraryQueries(queryClient, tenant?.tenantId);
    await queryClient.invalidateQueries({ queryKey: ['document-detail'], refetchType: 'all' });
  };

  const moveDocuments = useMutation({
    mutationFn: ({
      documentIds,
      targetClassId,
      reason,
    }: {
      documentIds: string[];
      targetClassId: string;
      reason?: string;
    }) =>
      documentIds.length === 1
        ? moveDocumentToCategory(documentIds[0]!, targetClassId, reason).then((result) => ({
            ok: result.ok,
            moved: result.moved,
            skipped: result.skipped,
            failed: [] as Array<{ documentId: string; error: string; code?: string }>,
            targetClassId: result.targetClassId,
            targetCategoryName: result.targetCategoryName,
          }))
        : batchMoveDocumentsToCategory(documentIds, targetClassId, reason),
    onSuccess: (result) => {
      if (result.failed.length > 0) {
        toast.warning(
          `${result.moved} movido(s), ${result.failed.length} falha(s).`,
        );
      } else if (result.moved === 0 && result.skipped.length > 0) {
        toast.info('Os documentos já estão nesta categoria.');
      } else {
        toast.success(
          result.moved === 1
            ? `Documento movido para ${result.targetCategoryName}.`
            : `${result.moved} documentos movidos para ${result.targetCategoryName}.`,
        );
      }
    },
    onError: (error) => {
      showApiErrorToast(error, 'Não foi possível mover o documento.');
    },
    onSettled: invalidate,
  });

  return { moveDocuments };
}
