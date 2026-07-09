import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { DocumentDetailPanel } from './DocumentDetailPanel';

type DocumentDetailDrawerProps = {
  open: boolean;
  documentId: string | null;
  initialMode?: 'details' | 'preview';
  onClose: () => void;
};

export function DocumentDetailDrawer({
  open,
  documentId,
  initialMode = 'details',
  onClose,
}: DocumentDetailDrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !documentId) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex justify-end modal-overlay-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-detail-drawer-title"
    >
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-doqyn-border bg-doqyn-bg shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-doqyn-border px-4 py-3">
          <h2 id="document-detail-drawer-title" className="text-[14px] font-semibold text-doqyn-text">
            Detalhes do documento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.md} />
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <DocumentDetailPanel
            documentId={documentId}
            initialFocusPreview={initialMode === 'preview'}
          />
        </div>
      </div>
    </div>
  );
}
