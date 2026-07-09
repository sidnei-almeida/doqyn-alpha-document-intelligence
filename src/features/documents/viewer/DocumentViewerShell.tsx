import type { ReactNode, RefObject } from 'react';
import { DocumentViewerFrame } from './DocumentViewerFrame';
import type { DocumentViewerToolbarProps } from './DocumentViewerToolbar';

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
      className="viewer-overlay-scrim fixed inset-0 z-[60] flex items-center justify-center p-3 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-viewer-modal-title"
    >
      <div
        ref={dialogRef}
        className="h-[94vh] w-[min(96vw,1400px)] max-sm:h-[100vh] max-sm:w-[100vw] max-sm:rounded-none"
      >
        <DocumentViewerFrame
          toolbar={toolbar}
          detailsPanel={detailsPanel}
          showDetails={showDetails}
          className="h-full w-full shadow-2xl max-sm:rounded-none max-sm:border-0"
        >
          {children}
        </DocumentViewerFrame>
      </div>
    </div>
  );
}
