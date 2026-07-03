import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferencesDto,
  type PlatformRole,
} from '@/features/users/api/usersApi';
import {
  AccessGroupsSection,
  DocumentGroupsSection,
  PlatformRolesSection,
  type AccessGroupOption,
  type DocumentGroupOption,
} from '@/features/users/components/AccessFormSections';
import { AccessRequestDetailsPanel } from '@/features/users/components/AccessRequestDetailsPanel';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';

type ApproveApprovalDialogProps = {
  open: boolean;
  item: PendingApprovalItem | null;
  accessGroups: AccessGroupOption[];
  documentGroups: DocumentGroupOption[];
  saving?: boolean;
  canAssignDoqynAdmin?: boolean;
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
  accessGroups,
  documentGroups,
  saving,
  canAssignDoqynAdmin = false,
  onClose,
  onConfirm,
}: ApproveApprovalDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>(['user']);
  const [accessGroupIds, setAccessGroupIds] = useState<string[]>([]);
  const [documentGroupIds, setDocumentGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPlatformRoles(['user']);
      setAccessGroupIds([]);
      setDocumentGroupIds([]);
    }
  }, [open, item?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-doqyn-text">Aprovar solicitação</h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              {item.name} · {item.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          <AccessRequestDetailsPanel
            member={item.member}
            requestedAccess={item.requestedAccess}
            whatsapp={item.member?.whatsapp}
            consent={item.member?.consent}
            terms={item.member?.terms}
            notificationPreferences={item.member?.notificationPreferences}
            className="mb-4 rounded-lg border border-doqyn-border bg-doqyn-card/40 p-3"
          />
          <PlatformRolesSection
            value={platformRoles}
            onChange={setPlatformRoles}
            canAssignDoqynAdmin={canAssignDoqynAdmin}
          />
          <AccessGroupsSection
            groups={accessGroups}
            value={accessGroupIds}
            onChange={setAccessGroupIds}
          />
          <DocumentGroupsSection
            groups={documentGroups}
            value={documentGroupIds}
            onChange={setDocumentGroupIds}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-doqyn-border px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm({
                platformRoles: platformRoles.length > 0 ? platformRoles : ['user'],
                accessGroupIds,
                documentGroupIds,
                notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
              })
            }
            disabled={saving}
          >
            {saving ? 'Aprovando…' : 'Confirmar aprovação'}
          </Button>
        </div>
      </div>
    </div>
  );
}
