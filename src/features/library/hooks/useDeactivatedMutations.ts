import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import {
  batchReactivateDocuments,
  reactivateDocument,
} from '../api/deactivatedApi';
import { invalidateLibraryQueries } from '../utils/libraryQueryInvalidation';

export function useDeactivatedMutations() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const invalidate = async () => {
    await invalidateLibraryQueries(queryClient, tenant?.tenantId);
    await queryClient.invalidateQueries({ queryKey: ['deactivated-documents'] });
    await queryClient.invalidateQueries({ queryKey: ['trash-documents'] });
  };

  const reactivate = useMutation({
    mutationFn: ({ documentIds }: { documentIds: string[] }) =>
      documentIds.length === 1
        ? reactivateDocument(documentIds[0]!).then(() => ({
            results: [{ documentId: documentIds[0]!, ok: true }],
            succeeded: 1,
            failed: 0,
          }))
        : batchReactivateDocuments(documentIds),
    onSuccess: (result) => {
      toast.success(
        result.succeeded === 1
          ? 'Documento recuperado.'
          : `${result.succeeded} documentos recuperados.`,
      );
    },
    onError: () => toast.error('Não foi possível recuperar o documento.'),
    onSettled: invalidate,
  });

  return { reactivate };
}
