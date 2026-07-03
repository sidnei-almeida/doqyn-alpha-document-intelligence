import type { ReactNode, RefObject } from 'react';
import { cn } from '@/lib/utils';
import { DocumentViewerToolbar, type DocumentViewerToolbarProps } from './DocumentViewerToolbar';

type DocumentViewerShellProps = {
  toolbar: DocumentViewerToolbarProps;
  children: ReactNode;
  detailsPanel?: ReactNode;
  showDetails?: boolean;
  overlayRef?: RefObject<HTMLDivElement | null>;
  dialogRef?: RefObject<HTMLDivElement | null>;
  onOverlayClick?: () => void;
};

export function DocumentViewerShell({
  toolbar,
  children,
  detailsPanel,
  showDetails = false,
  overlayRef,
  dialogRef,
  onOverlayClick,
}: DocumentViewerShellProps) {
  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef?.current && onOverlayClick?.()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-viewer-modal-title"
    >
      <div
        ref={dialogRef}
        className="viewer-shell flex h-[94vh] w-[min(96vw,1400px)] flex-col overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-bg shadow-2xl sm:h-[94vh] max-sm:h-[100vh] max-sm:w-[100vw] max-sm:rounded-none"
      >
        <DocumentViewerToolbar {...toolbar} />

        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-0 min-w-0 flex-1 bg-doqyn-surface">{children}</div>

          <aside
            className={cn(
              'viewer-details-panel shrink-0 overflow-hidden border-l border-doqyn-border bg-doqyn-bg transition-[width] duration-200',
              showDetails ? 'w-[min(100%,320px)]' : 'w-0 border-l-0',
            )}
            aria-hidden={!showDetails}
          >
            {showDetails && detailsPanel}
          </aside>
        </div>
      </div>
    </div>
  );
}
