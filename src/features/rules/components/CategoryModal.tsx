import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CategoryModal({ open, onClose, onCreate }: CategoryModalProps) {
  const [name, setName] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center modal-overlay-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-doqyn-border bg-doqyn-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="category-modal-title" className="text-lg font-semibold text-doqyn-text">
            Nova categoria
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doqyn-muted hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.md} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="category-name"
            label="Nome"
            placeholder="ex: Contrato, Nota Fiscal, Proposta..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Criar categoria
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
