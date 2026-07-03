import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValue('');
      setError('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (required && !trimmed) {
      setError('Este campo é obrigatório.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface shadow-modal"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border-subtle px-5 py-4">
          <div>
            <h2 id="prompt-dialog-title" className="text-base font-semibold text-doqyn-text">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-doqyn-muted">{description}</p>
            ) : null}
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

        <div className="px-5 py-4">
          <Textarea
            ref={inputRef}
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
        </div>

        <div className="flex justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Aguarde…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
