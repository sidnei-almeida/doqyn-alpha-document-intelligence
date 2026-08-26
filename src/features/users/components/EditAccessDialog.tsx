import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/confirm/useConfirm';
import type { CompanyMemberDto } from '../api/usersApi';
import { cloneAccessFormState, isAccessFormDirty, type AccessFormState } from '../accessFormState';
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
  saving: boolean;
  onClose: () => void;
  onSave: (form: AccessFormState) => void;
};

export function EditAccessDialog({
  member,
  memberName,
  initialForm,
  documentGroups,
  saving,
  onClose,
  onSave,
}: EditAccessDialogProps) {
  const confirm = useConfirm();
  const baselineRef = useRef(cloneAccessFormState(initialForm));
  const [form, setForm] = useState(() => cloneAccessFormState(initialForm));

  useEffect(() => {
    const baseline = cloneAccessFormState(initialForm);
    baselineRef.current = baseline;
    setForm(baseline);
  }, [member.id, initialForm]);

  const dirty = useMemo(() => isAccessFormDirty(form, baselineRef.current), [form]);

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
    <Modal
      open
      onClose={() => void requestClose()}
      title={`Editar acesso — ${memberName}`}
      subtitle={member.email}
      size="lg"
      // Há dado digitado em jogo: clicar fora não pode descartar em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <p className="mr-auto text-caption text-doqyn-subtle">
            {dirty ? 'Alterações não salvas' : 'Nenhuma alteração pendente'}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => onSave(form)} disabled={!dirty || saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <PlatformRolesSection
          value={form.platformRoles}
          onChange={(platformRoles) => setForm((current) => ({ ...current, platformRoles }))}
        />
        <DocumentGroupsSection
          groups={documentGroups}
          value={form.documentGroupIds}
          onChange={(documentGroupIds) => setForm((current) => ({ ...current, documentGroupIds }))}
        />
        <NotificationsSection
          value={form.notificationPreferences}
          onChange={(notificationPreferences) =>
            setForm((current) => ({ ...current, notificationPreferences }))
          }
        />
      </div>
    </Modal>
  );
}
