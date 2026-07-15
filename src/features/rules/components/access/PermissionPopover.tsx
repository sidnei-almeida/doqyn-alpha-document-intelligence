import { useState, type RefObject } from 'react';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';

type PermissionRow = {
  key: 'view' | 'download' | 'upload';
  label: string;
  hint: string;
};

const PERMISSION_ROWS: PermissionRow[] = [
  { key: 'view', label: 'Ver documentos', hint: 'aparecem na biblioteca e no viewer' },
  { key: 'download', label: 'Baixar', hint: 'download do arquivo original' },
  { key: 'upload', label: 'Enviar', hint: 'contribuir com novos documentos' },
];

type PermissionPopoverProps = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  group: Group;
  memberCount: number;
  categoryName: string;
  permissions: DocumentAccessPermissions;
  onChange: (permissions: DocumentAccessPermissions) => Promise<void>;
  onRemove: () => Promise<void>;
  onOpenGroupDetails?: () => void;
};

/**
 * Popover de permissões de um grupo em uma categoria — modelo mental do
 * "compartilhar" do Drive: três permissões em linguagem simples + remover.
 */
export function PermissionPopover({
  anchorRef,
  open,
  onClose,
  group,
  memberCount,
  categoryName,
  permissions,
  onChange,
  onRemove,
  onOpenGroupDetails,
}: PermissionPopoverProps) {
  const [saving, setSaving] = useState(false);

  const toggle = async (key: PermissionRow['key'], value: boolean) => {
    setSaving(true);
    try {
      await onChange({ ...permissions, [key]: value });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnchoredPopover
      anchorRef={anchorRef}
      open={open}
      onClose={onClose}
      placement="bottom-start"
      className="w-72 p-2"
      aria-label={`Permissões de ${group.name} em ${categoryName}`}
    >
      <div className="flex items-center gap-2.5 border-b border-doqyn-border-subtle px-2.5 pb-2.5 pt-1.5">
        <div className="min-w-0 flex-1">
          <p className="type-label truncate text-doqyn-text">{group.name}</p>
          <p className="type-caption truncate text-doqyn-muted">
            {memberCount} {memberCount === 1 ? 'pessoa' : 'pessoas'} · em “{categoryName}”
          </p>
        </div>
        {onOpenGroupDetails && (
          <button
            type="button"
            className="type-caption shrink-0 font-medium text-doqyn-primary hover:underline"
            onClick={() => {
              onClose();
              onOpenGroupDetails();
            }}
          >
            Detalhes
          </button>
        )}
      </div>

      <div className="pt-1.5">
        {PERMISSION_ROWS.map((row) => (
          <label
            key={row.key}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-doqyn-surface-hover',
              saving && 'pointer-events-none opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={permissions[row.key]}
              disabled={saving}
              onChange={(event) => void toggle(row.key, event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="type-body block text-doqyn-text">{row.label}</span>
              <span className="type-caption block text-doqyn-subtle">{row.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void remove()}
        className="hover:bg-doqyn-danger-bg/40 mt-1.5 flex w-full items-center gap-2 rounded-lg border-t border-doqyn-border-subtle px-2.5 py-2 text-left font-display text-label font-medium text-doqyn-danger disabled:opacity-60"
      >
        Remover acesso do grupo
      </button>
    </AnchoredPopover>
  );
}
