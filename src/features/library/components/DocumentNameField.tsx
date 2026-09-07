import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { DrawerSection } from '@/components/ui/DrawerSection';
import { renameDocument } from '@/features/expiry/api/expiryApi';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';

type DocumentNameFieldProps = {
  documentId: string;
  fileName: string;
  canEdit: boolean;
};

/**
 * Nome do documento, editável na própria ficha.
 *
 * O nome é rótulo do documento, não do arquivo guardado: renomear muda como ele
 * se chama daqui para a frente e não reescreve as versões anteriores, que
 * continuam registradas com o nome que tinham quando entraram. A identidade é o
 * id do documento — por isso a trilha consegue mostrar "chamava-se X, agora
 * chama-se Y" em vez de dois documentos sem relação.
 */
export function DocumentNameField({ documentId, fileName, canEdit }: DocumentNameFieldProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(fileName);

  useEffect(() => {
    setDraft(fileName);
  }, [fileName, documentId]);

  const mutation = useMutation({
    mutationFn: (nextName: string) => renameDocument(documentId, nextName),
    onSuccess: async (result) => {
      setDraft(result.fileName);
      showAppToast({ type: 'success', title: 'Nome atualizado.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
        queryClient.invalidateQueries({ queryKey: ['document-detail', documentId] }),
        queryClient.invalidateQueries({ queryKey: ['document-metadata-sheet', documentId] }),
      ]);
    },
    onError: (error: Error) => showApiErrorToast(error),
  });

  const trimmed = draft.trim();
  const isDirty = trimmed !== fileName.trim();
  const canSave = canEdit && isDirty && trimmed.length > 0 && !mutation.isPending;

  return (
    <DrawerSection label="Nome do documento" className="border-t-0 pt-0">
      {canEdit ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) mutation.mutate(trimmed);
          }}
        >
          <label className="field-rule min-w-0 flex-1">
            <input
              id="document-name"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Escape desfaz a edição em curso: sair sem salvar não pode
                // exigir apagar o texto de volta na mão.
                if (event.key === 'Escape') setDraft(fileName);
              }}
              aria-label="Nome do documento"
              className="text-label"
              disabled={mutation.isPending}
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" disabled={!canSave}>
            {mutation.isPending ? 'Salvando…' : 'Renomear'}
          </Button>
        </form>
      ) : (
        <p className="text-label text-doqyn-text">{fileName}</p>
      )}

      {isDirty && canEdit ? (
        <p className="mt-1.5 text-caption text-doqyn-subtle">
          As versões anteriores continuam com o nome que tinham.
        </p>
      ) : null}
    </DrawerSection>
  );
}
