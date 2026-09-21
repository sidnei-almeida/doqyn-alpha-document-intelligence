import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import type { DocumentListItem } from '@/types/document-library';
import { transferDocumentOwnership } from '@/features/documents/api/documentsApi';
import { useCompanyMembers } from '@/features/users/hooks/useCompanyMembers';
import { useAuth } from '@/auth/useAuth';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('documents');

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
        throw new Error(t('transferOwnershipModal.selectOwner'));
      }
      return transferDocumentOwnership(document.documentId, {
        newOwnerUserId: selectedUserId,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (response) => {
      showAppToast({
        type: 'success',
        title: t('transferOwnershipModal.transferred', { name: response.result.newOwnerName }),
      });
      void invalidateLibraryQueries(queryClient, tenant?.tenantId);
      setSelectedUserId('');
      setReason('');
      onClose();
    },
    onError: (error) => {
      showApiErrorToast(error, t('transferOwnershipModal.transferFailed'));
    },
  });

  if (!open || !document) return null;

  const documentName =
    document.currentFileName ?? document.displayName ?? t('documentDetailsShared.documento');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('transferOwnershipModal.transferirPropriedade')}
      subtitle={documentName}
      size="sm"
      // Destino e motivo já escolhidos: clicar fora não descarta em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={transferMutation.isPending}
          >
            {t('transferOwnershipModal.cancelar')}
          </Button>
          <Button
            type="button"
            onClick={() => void transferMutation.mutate()}
            disabled={!selectedUserId || transferMutation.isPending}
          >
            {t('transferOwnershipModal.transferir')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2 text-sm">
          <p className="text-doqyn-muted">{t('transferOwnershipModal.proprietarioAtual')}</p>
          <p className="font-medium text-doqyn-text">
            {document.ownerName ?? document.createdBy?.displayName ?? '—'}
          </p>
        </div>

        <Select
          id="transfer-ownership-target"
          label={t('transferOwnershipModal.novoProprietario')}
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          options={[
            { value: '', label: t('transferOwnershipModal.selectUser') },
            ...eligibleMembers.map((member) => ({
              value: memberUserId(member),
              label: memberDisplayName(member),
            })),
          ]}
          disabled={membersQuery.isLoading || transferMutation.isPending}
        />

        <Input
          id="transfer-ownership-reason"
          label={t('transferOwnershipModal.motivoOpcional')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('transferOwnershipModal.exMudancaDeResponsavel')}
          disabled={transferMutation.isPending}
        />
      </div>
    </Modal>
  );
}
