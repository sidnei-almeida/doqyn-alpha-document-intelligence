import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferencesDto,
  type PlatformRole,
} from '@/features/users/api/usersApi';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';

const PLATFORM_ROLES: PlatformRole[] = ['doqyn_admin', 'company_admin', 'user'];

type ApproveApprovalDialogProps = {
  open: boolean;
  item: PendingApprovalItem | null;
  groups: Array<{ id: string; name: string }>;
  saving?: boolean;
  canAssignDoqynAdmin?: boolean;
  onClose: () => void;
  onConfirm: (input: {
    platformRoles: PlatformRole[];
    accessGroupIds: string[];
    notificationPreferences: NotificationPreferencesDto;
  }) => void;
};

export function ApproveApprovalDialog({
  open,
  item,
  groups,
  saving,
  canAssignDoqynAdmin = false,
  onClose,
  onConfirm,
}: ApproveApprovalDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>(['user']);
  const [accessGroupIds, setAccessGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPlatformRoles(['user']);
      setAccessGroupIds([]);
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
      <div className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl">
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

        <div className="space-y-4 px-5 py-4 text-sm">
          <div>
            <p className="mb-2 text-xs font-medium text-doqyn-muted">Papéis</p>
            <div className="flex flex-wrap gap-3">
              {PLATFORM_ROLES.map((role) => {
                const disabled = role === 'doqyn_admin' && !canAssignDoqynAdmin;
                const checked = platformRoles.includes(role);
                return (
                  <label key={role} className="flex items-center gap-2 text-doqyn-text">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => {
                        if (checked) {
                          setPlatformRoles(platformRoles.filter((value) => value !== role));
                        } else {
                          setPlatformRoles([...platformRoles, role]);
                        }
                      }}
                    />
                    {role}
                  </label>
                );
              })}
            </div>
          </div>

          {groups.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-doqyn-muted">Grupos de acesso</p>
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {groups.map((group) => {
                  const checked = accessGroupIds.includes(group.id);
                  return (
                    <label key={group.id} className="flex items-center gap-2 text-doqyn-text">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setAccessGroupIds(accessGroupIds.filter((id) => id !== group.id));
                          } else {
                            setAccessGroupIds([...accessGroupIds, group.id]);
                          }
                        }}
                      />
                      {group.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
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
                notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
              })
            }
            disabled={saving}
          >
            Confirmar aprovação
          </Button>
        </div>
      </div>
    </div>
  );
}
