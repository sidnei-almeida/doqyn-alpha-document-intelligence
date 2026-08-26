import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferencesDto,
  type PlatformRole,
} from '@/features/users/api/usersApi';
import {
  DocumentGroupsSection,
  PlatformRolesSection,
  type DocumentGroupOption,
} from '@/features/users/components/AccessFormSections';
import { AccessRequestDetailsPanel } from '@/features/users/components/AccessRequestDetailsPanel';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';

type ApproveApprovalDialogProps = {
  open: boolean;
  item: PendingApprovalItem | null;
  documentGroups: DocumentGroupOption[];
  saving?: boolean;
  onClose: () => void;
  onConfirm: (input: {
    platformRoles: PlatformRole[];
    accessGroupIds: string[];
    documentGroupIds: string[];
    notificationPreferences: NotificationPreferencesDto;
  }) => void;
};

export function ApproveApprovalDialog({
  open,
  item,
  documentGroups,
  saving,
  onClose,
  onConfirm,
}: ApproveApprovalDialogProps) {
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>(['user']);
  const [documentGroupIds, setDocumentGroupIds] = useState<string[]>([]);

  // O diálogo fica montado entre uma solicitação e outra: sem isto, os grupos
  // escolhidos para a pessoa anterior reapareceriam na próxima.
  useEffect(() => {
    if (!open) return;
    setPlatformRoles(['user']);
    setDocumentGroupIds([]);
  }, [open, item?.id]);

  if (!open || !item) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Aprovar solicitação"
      subtitle={`${item.name} · ${item.email}`}
      size="lg"
      // Papel e grupos já escolhidos: clicar fora não pode descartar em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm({
                platformRoles: platformRoles.length > 0 ? platformRoles : ['user'],
                accessGroupIds: [],
                documentGroupIds,
                notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
              })
            }
            disabled={saving}
          >
            {saving ? 'Aprovando…' : 'Confirmar aprovação'}
          </Button>
        </>
      }
    >
      <AccessRequestDetailsPanel
        member={item.member}
        requestedAccess={item.requestedAccess}
        whatsapp={item.member?.whatsapp}
        consent={item.member?.consent}
        terms={item.member?.terms}
        notificationPreferences={item.member?.notificationPreferences}
        className="mb-4 rounded-lg border border-doqyn-border bg-doqyn-card/40 p-3"
      />
      <PlatformRolesSection value={platformRoles} onChange={setPlatformRoles} />
      <DocumentGroupsSection
        groups={documentGroups}
        value={documentGroupIds}
        onChange={setDocumentGroupIds}
      />
    </Modal>
  );
}
