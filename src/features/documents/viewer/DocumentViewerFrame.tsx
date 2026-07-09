import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DocumentViewerToolbar, type DocumentViewerToolbarProps } from './DocumentViewerToolbar';

type DocumentViewerFrameProps = {
  toolbar: DocumentViewerToolbarProps;
  children: ReactNode;
  detailsPanel?: ReactNode;
  showDetails?: boolean;
  className?: string;
};

/** Estrutura interna do visualizador — toolbar + palco (+ painel de detalhes opcional). */
export function DocumentViewerFrame({
  toolbar,
  children,
  detailsPanel,
  showDetails = false,
  className,
}: DocumentViewerFrameProps) {
  return (
    <div
      className={cn(
        'viewer-shell flex flex-col overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-bg',
        className,
      )}
    >
      <DocumentViewerToolbar {...toolbar} />

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1 bg-doqyn-thumbnail-chrome">{children}</div>

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
  );
}
