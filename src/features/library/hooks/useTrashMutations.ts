import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import {
  batchMoveDocumentsToTrash,
  batchRestoreDocuments,
  fetchTrashRetentionSettings,
  moveDocumentToTrash,
  restoreDocumentFromTrash,
  updateTrashRetentionSettings,
  type TrashRetentionSettings,
} from '../api/trashApi';
import { invalidateLibraryQueries } from '../utils/libraryQueryInvalidation';

export function useTrashMutations() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const invalidate = async () => {
    await invalidateLibraryQueries(queryClient, tenant?.tenantId);
    await queryClient.invalidateQueries({ queryKey: ['trash-documents'] });
    await queryClient.invalidateQueries({ queryKey: ['deactivated-documents'] });
  };

  const moveToTrash = useMutation({
    mutationFn: ({ documentIds }: { documentIds: string[] }) =>
      documentIds.length === 1
        ? moveDocumentToTrash(documentIds[0]!).then(() => ({
            results: [{ documentId: documentIds[0]!, ok: true }],
            succeeded: 1,
            failed: 0,
          }))
        : batchMoveDocumentsToTrash(documentIds),
    onSuccess: (result) => {
      if (result.failed > 0) {
        toast.warning(`${result.succeeded} movido(s), ${result.failed} falha(s).`);
      } else {
        toast.success(
          result.succeeded === 1
            ? 'Documento movido para a lixeira.'
            : `${result.succeeded} documentos movidos para a lixeira.`,
        );
      }
    },
    onError: () => toast.error('Não foi possível mover para a lixeira.'),
    onSettled: invalidate,
  });

  const restore = useMutation({
    mutationFn: ({ documentIds }: { documentIds: string[] }) =>
      documentIds.length === 1
        ? restoreDocumentFromTrash(documentIds[0]!).then(() => ({
            results: [{ documentId: documentIds[0]!, ok: true }],
            succeeded: 1,
            failed: 0,
          }))
        : batchRestoreDocuments(documentIds),
    onSuccess: (result) => {
      toast.success(
        result.succeeded === 1
          ? 'Documento restaurado.'
          : `${result.succeeded} documentos restaurados.`,
      );
    },
    onError: () => toast.error('Não foi possível restaurar o documento.'),
    onSettled: invalidate,
  });

  return { moveToTrash, restore };
}

export function useTrashRetentionSettings() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['trash-retention-settings'],
    queryFn: fetchTrashRetentionSettings,
    enabled: isAuthenticated,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<TrashRetentionSettings>) => updateTrashRetentionSettings(patch),
    onSuccess: () => {
      toast.success('Configurações da lixeira atualizadas.');
      void queryClient.invalidateQueries({ queryKey: ['trash-retention-settings'] });
    },
    onError: () => toast.error('Não foi possível salvar as configurações.'),
  });

  return { ...query, updateSettings: mutation.mutate, isSaving: mutation.isPending };
}
