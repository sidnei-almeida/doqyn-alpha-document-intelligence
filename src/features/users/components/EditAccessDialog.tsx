import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/confirm/useConfirm';
import type { CompanyMemberDto } from '../api/usersApi';
import {
  cloneAccessFormState,
  isAccessFormDirty,
  type AccessFormState,
} from '../accessFormState';
import {
  DocumentGroupsSection,
  NotificationsSection,
  PlatformRolesSection,
  type DocumentGroupOption,
} from './AccessFormSections';

type EditAccessDialogProps = {
  member: CompanyMemberDto;
  memberName: string;
  initialForm: AccessFormState;
  documentGroups: DocumentGroupOption[];
  canAssignDoqynAdmin: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (form: AccessFormState) => void;
};

export function EditAccessDialog({
  member,
  memberName,
  initialForm,
  documentGroups,
  canAssignDoqynAdmin,
  saving,
  onClose,
  onSave,
}: EditAccessDialogProps) {
  const confirm = useConfirm();
  const overlayRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef(cloneAccessFormState(initialForm));
  const [form, setForm] = useState(() => cloneAccessFormState(initialForm));

  useEffect(() => {
    const baseline = cloneAccessFormState(initialForm);
    baselineRef.current = baseline;
    setForm(baseline);
  }, [member.id, initialForm]);

  const dirty = useMemo(() => isAccessFormDirty(form, baselineRef.current), [form]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void requestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const requestClose = async () => {
    if (dirty) {
      const shouldDiscard = await confirm({
        title: 'Descartar alterações?',
        description: 'As alterações de acesso não salvas serão perdidas.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        variant: 'warning',
      });
      if (!shouldDiscard) return;
    }
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) void requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-access-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border-subtle px-5 py-4">
          <div>
            <h2 id="edit-access-title" className="text-base font-semibold text-doqyn-text">
              Editar acesso — {memberName}
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">{member.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void requestClose()}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        </div>

        <div className="space-y-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          <PlatformRolesSection
            value={form.platformRoles}
            onChange={(platformRoles) => setForm((current) => ({ ...current, platformRoles }))}
            canAssignDoqynAdmin={canAssignDoqynAdmin}
          />
          <DocumentGroupsSection
            groups={documentGroups}
            value={form.documentGroupIds}
            onChange={(documentGroupIds) =>
              setForm((current) => ({ ...current, documentGroupIds }))
            }
          />
          <NotificationsSection
            value={form.notificationPreferences}
            onChange={(notificationPreferences) =>
              setForm((current) => ({ ...current, notificationPreferences }))
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-doqyn-border-subtle px-5 py-4">
          <p className="text-xs text-doqyn-subtle">
            {dirty ? 'Alterações não salvas' : 'Nenhuma alteração pendente'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void requestClose()} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => onSave(form)}
              disabled={!dirty || saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
