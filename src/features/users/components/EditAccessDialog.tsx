import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LeadDetail } from '@/components/ui/LeadDetail';
import { useConfirm } from '@/components/confirm/useConfirm';
import type { CompanyMemberDto } from '../api/usersApi';
import { cloneAccessFormState, isAccessFormDirty, type AccessFormState } from '../accessFormState';
import {
  DocumentGroupsSection,
  NotificationsSection,
  PlatformRolesSection,
  type DocumentGroupOption,
} from './AccessFormSections';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('users');

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
        title: t('editAccessDialog.discard.title'),
        description: t('editAccessDialog.discard.description'),
        confirmLabel: t('editAccessDialog.discard.confirm'),
        cancelLabel: t('editAccessDialog.discard.cancel'),
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
      title={t('editAccessDialog.editarAcesso')}
      subtitle={<LeadDetail lead={memberName} detail={member.email} />}
      size="lg"
      // Há dado digitado em jogo: clicar fora não pode descartar em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <p className="mr-auto text-caption text-doqyn-subtle">
            {dirty ? t('editAccessDialog.unsaved') : t('editAccessDialog.noChanges')}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void requestClose()}
            disabled={saving}
          >
            {t('editAccessDialog.cancelar')}
          </Button>
          <Button type="button" onClick={() => onSave(form)} disabled={!dirty || saving}>
            {saving ? t('editAccessDialog.saving') : t('common:actions.save')}
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
