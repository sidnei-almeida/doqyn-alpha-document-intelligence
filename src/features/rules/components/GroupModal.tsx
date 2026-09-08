import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DEFAULT_GROUP_COLOR, type GroupColor } from '@shared/groupPalette';
import { GroupPalettePicker } from './GroupPalettePicker';
import { useTranslation } from 'react-i18next';

interface GroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color: GroupColor) => void;
}

const FORM_ID = 'novo-grupo';

export function GroupModal({ open, onClose, onCreate }: GroupModalProps) {
  const { t } = useTranslation('rules');

  const [name, setName] = useState('');
  const [color, setColor] = useState<GroupColor>(DEFAULT_GROUP_COLOR);

  useEffect(() => {
    if (!open) {
      setName('');
      setColor(DEFAULT_GROUP_COLOR);
    }
  }, [open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('groupModal.novoGrupo')}
      subtitle="Grupo é o que conecta pessoas a categorias de documentos."
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('groupModal.cancelar')}
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={!name.trim()}>
            {t('groupModal.criarGrupo')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="group-name"
          variant="rule"
          label={t('groupModal.nomeDoGrupo')}
          placeholder={t('groupModal.juridicoFinanceiro')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <GroupPalettePicker value={color} onChange={setColor} />

        <p className="type-caption text-doqyn-subtle">{t('groupModal.asPessoasEntramNo')}</p>
      </form>
    </Modal>
  );
}
