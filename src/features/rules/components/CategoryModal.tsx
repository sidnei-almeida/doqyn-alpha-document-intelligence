import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

const FORM_ID = 'nova-categoria';

export function CategoryModal({ open, onClose, onCreate }: CategoryModalProps) {
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
      title="Nova categoria"
      subtitle="Categoria é a pasta da Biblioteca vista pela governança."
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={!name.trim()}>
            Criar categoria
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="category-name"
          variant="rule"
          label="Nome da categoria"
          placeholder="Contratos, Notas fiscais…"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <p className="type-caption text-doqyn-subtle">
          Depois de criada, você conecta os grupos que enxergam os documentos dela.
        </p>
      </form>
    </Modal>
  );
}
