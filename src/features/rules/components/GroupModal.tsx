import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { GroupColor } from '@/types/rules';

interface GroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color: GroupColor) => void;
}

export function GroupModal({ open, onClose, onCreate }: GroupModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<GroupColor>('blue');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setColor('blue');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center modal-overlay-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-doqyn-border bg-doqyn-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="group-modal-title" className="text-lg font-semibold text-doqyn-text">
            Novo grupo
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
            id="group-name"
            label="Nome do grupo"
            placeholder="ex: Jurídico, Financeiro..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Select
            id="group-color"
            label="Cor"
            value={color}
            onChange={(e) => setColor(e.target.value as GroupColor)}
            options={[
              { value: 'blue', label: 'Azul' },
              { value: 'green', label: 'Verde' },
              { value: 'amber', label: 'Amarelo' },
              { value: 'red', label: 'Vermelho' },
              { value: 'purple', label: 'Roxo' },
            ]}
          />

          <p className="text-xs text-doqyn-muted">
            Membros são associados aos grupos na aba Membros.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Criar grupo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
