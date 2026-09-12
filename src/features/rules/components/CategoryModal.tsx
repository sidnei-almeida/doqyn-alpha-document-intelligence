import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from 'react-i18next';

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

const FORM_ID = 'nova-categoria';

export function CategoryModal({ open, onClose, onCreate }: CategoryModalProps) {
  const { t } = useTranslation('rules');

  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('categoryModal.novaCategoria')}
      subtitle={t('categoryModal.subtitle')}
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('categoryModal.cancelar')}
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={!name.trim()}>
            {t('categoryModal.criarCategoria')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="category-name"
          variant="rule"
          label={t('categoryModal.nomeDaCategoria')}
          placeholder={t('categoryModal.contratosNotasFiscais')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <p className="type-caption text-doqyn-subtle">{t('categoryModal.depoisDeCriadaVoce')}</p>
      </form>
    </Modal>
  );
}
