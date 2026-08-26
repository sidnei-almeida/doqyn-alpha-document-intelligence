import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  required = true,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  // O componente fica montado entre uma abertura e outra: sem isto, o texto da
  // vez anterior reaparece.
  useEffect(() => {
    if (!open) return;
    setValue('');
    setError('');
  }, [open]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (required && !trimmed) {
      setError('Este campo é obrigatório.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      size="sm"
      // Há texto digitado em jogo: clicar fora não pode descartar em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Aguarde…' : confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        id="prompt-dialog-input"
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError('');
        }}
        rows={4}
        error={error}
      />
    </Modal>
  );
}
