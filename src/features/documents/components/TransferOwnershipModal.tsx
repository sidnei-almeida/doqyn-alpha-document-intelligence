import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import type { DocumentListItem } from '@/types/document-library';
import { transferDocumentOwnership } from '@/features/documents/api/documentsApi';
import { useCompanyMembers } from '@/features/users/hooks/useCompanyMembers';
import { useAuth } from '@/auth/useAuth';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';

type TransferOwnershipModalProps = {
  open: boolean;
  document: DocumentListItem | null;
  onClose: () => void;
};

function memberDisplayName(member: {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
}): string {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return member.name?.trim() || member.email;
}

function memberUserId(member: { id: string; authUserId?: string }): string {
  return member.authUserId?.trim() || member.id;
}

export function TransferOwnershipModal({ open, document, onClose }: TransferOwnershipModalProps) {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const membersQuery = useCompanyMembers(tenant?.tenantId ?? '');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');

  const eligibleMembers = useMemo(() => {
    if (!document) return [];
    return (membersQuery.data?.members ?? []).filter((member) => {
      if (member.status !== 'active') return false;
      const userId = memberUserId(member);
      return userId !== document.ownerUserId;
    });
  }, [document, membersQuery.data?.members]);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!document || !selectedUserId) {
        throw new Error('Selecione o novo proprietário.');
      }
      return transferDocumentOwnership(document.documentId, {
        newOwnerUserId: selectedUserId,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (response) => {
      showAppToast({
        type: 'success',
        title: `Propriedade transferida para ${response.result.newOwnerName}.`,
      });
      void invalidateLibraryQueries(queryClient, tenant?.tenantId);
      setSelectedUserId('');
      setReason('');
      onClose();
    },
    onError: (error) => {
      showApiErrorToast(error, 'Não foi possível transferir a propriedade.');
    },
  });

  if (!open || !document) return null;

  const documentName = document.currentFileName ?? document.displayName ?? 'Documento';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-ownership-title"
        className="w-full max-w-md rounded-xl border border-doqyn-border-subtle bg-doqyn-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="transfer-ownership-title" className="text-base font-semibold text-doqyn-text">
              Transferir propriedade
            </h2>
            <p className="mt-1 text-sm text-doqyn-muted">{documentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2 text-sm">
            <p className="text-doqyn-muted">Proprietário atual</p>
            <p className="font-medium text-doqyn-text">
              {document.ownerName ?? document.createdBy?.displayName ?? '—'}
            </p>
          </div>

          <Select
            id="transfer-ownership-target"
            label="Novo proprietário"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            options={[
              { value: '', label: 'Selecione um usuário' },
              ...eligibleMembers.map((member) => ({
                value: memberUserId(member),
                label: memberDisplayName(member),
              })),
            ]}
            disabled={membersQuery.isLoading || transferMutation.isPending}
          />

          <Input
            id="transfer-ownership-reason"
            label="Motivo (opcional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: mudança de responsável pela pasta"
            disabled={transferMutation.isPending}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={transferMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void transferMutation.mutate()}
            disabled={!selectedUserId || transferMutation.isPending}
          >
            Transferir
          </Button>
        </div>
      </div>
    </div>
  );
}
