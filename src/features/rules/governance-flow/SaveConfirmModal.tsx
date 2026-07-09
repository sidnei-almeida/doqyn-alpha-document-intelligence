import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { GovernancePendingCounts } from './draftReducer';

export const SAVE_CONFIRMATION_PHRASE = 'CONFIRMAR ALTERAÇÕES';

type SaveConfirmModalProps = {
  open: boolean;
  counts: GovernancePendingCounts;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Confirmação robusta do Salvar: exige digitar a frase exata e mostra o resumo
 * das alterações pendentes (conexões adicionadas/removidas e cards movidos).
 */
export function SaveConfirmModal({
  open,
  counts,
  saving,
  onClose,
  onConfirm,
}: SaveConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (open) setTypedText('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const textMatches = typedText.trim() === SAVE_CONFIRMATION_PHRASE;

  const summaryItems = [
    { icon: 'add_link', label: pluralize(counts.added, 'conexão adicionada', 'conexões adicionadas') },
    { icon: 'link_off', label: pluralize(counts.removed, 'conexão removida', 'conexões removidas') },
    { icon: 'open_with', label: pluralize(counts.moved, 'card movido', 'cards movidos') },
  ];

  const handleConfirm = () => {
    if (!textMatches || saving) return;
    onConfirm();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[var(--z-confirm)] flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-confirm-modal-title"
      onClick={(event) => {
        if (event.target === overlayRef.current && !saving) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface shadow-modal">
        <div className="flex items-start justify-between border-b border-doqyn-border-subtle px-5 py-4">
          <div>
            <h2 id="save-confirm-modal-title" className="text-base font-semibold text-doqyn-text">
              Salvar alterações do mapa
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              Revise o resumo antes de aplicar as regras de acesso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text disabled:opacity-50"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.sm} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <ul className="space-y-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 p-3">
            {summaryItems.map((item) => (
              <li key={item.icon} className="flex items-center gap-2 text-sm text-doqyn-text">
                <Icon name={item.icon} size={ICON_SIZE.xs} className="shrink-0 text-doqyn-muted" />
                {item.label}
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <p className="text-xs text-doqyn-muted">
              Digite{' '}
              <span className="font-mono font-medium text-doqyn-text">
                {SAVE_CONFIRMATION_PHRASE}
              </span>{' '}
              para confirmar:
            </p>
            <Input
              id="save-confirm-modal-input"
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleConfirm();
              }}
              placeholder={SAVE_CONFIRMATION_PHRASE}
              autoComplete="off"
              autoFocus
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" disabled={!textMatches || saving} onClick={handleConfirm}>
            <Icon name="save" size={ICON_SIZE.xs} />
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </div>
    </div>
  );
}
