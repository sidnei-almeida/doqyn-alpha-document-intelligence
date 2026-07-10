import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';

function dragEventHasFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

type LibraryContentDropZoneProps = {
  children: ReactNode;
  onDropFiles: (files: File[]) => void;
  className?: string;
  onBackgroundContextMenu?: (event: React.MouseEvent) => void;
  onBackgroundClick?: (event: React.MouseEvent) => void;
};

/**
 * Área de conteúdo da Biblioteca com drop de arquivos (nativo + useDroppable do dnd-kit).
 * O dnd-kit marca a zona; os arquivos do SO entram via eventos HTML5.
 */
export function LibraryContentDropZone({
  children,
  onDropFiles,
  className,
  onBackgroundContextMenu,
  onBackgroundClick,
}: LibraryContentDropZoneProps) {
  const [nativeDragging, setNativeDragging] = useState(false);
  const depthRef = useRef(0);
  const { setNodeRef, isOver } = useDroppable({ id: 'library-content-drop' });

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
    },
    [setNodeRef],
  );

  const showDropHint = nativeDragging || isOver;

  return (
    <div
      ref={setRef}
      className={cn('relative flex min-h-0 min-h-full flex-1 flex-col', className)}
      data-testid="library-content-dropzone"
      onDragEnter={(event) => {
        if (!dragEventHasFiles(event)) return;
        event.preventDefault();
        depthRef.current += 1;
        setNativeDragging(true);
      }}
      onDragOver={(event) => {
        if (!dragEventHasFiles(event)) return;
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!dragEventHasFiles(event)) return;
        event.preventDefault();
        depthRef.current = Math.max(0, depthRef.current - 1);
        if (depthRef.current === 0) setNativeDragging(false);
      }}
      onDrop={(event) => {
        if (!dragEventHasFiles(event)) return;
        event.preventDefault();
        depthRef.current = 0;
        setNativeDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onDropFiles(files);
      }}
      onContextMenu={onBackgroundContextMenu}
      onClick={(event) => {
        if (!onBackgroundClick) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-explorer-item]')) return;
        onBackgroundClick(event);
      }}
    >
      {children}

      {showDropHint && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border border-dashed border-doqyn-accent-active/40 bg-doqyn-bg/75 backdrop-blur-[2px]"
          role="presentation"
          data-testid="library-drop-overlay"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-doqyn-border-subtle bg-doqyn-surface px-8 py-6 text-center shadow-dropdown">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-doqyn-border-subtle bg-doqyn-card text-doqyn-muted">
              <Icon name="cloud_upload" size={ICON_SIZE.md} />
            </span>
            <p className="text-[15px] font-medium text-doqyn-text">Solte para enviar</p>
            <p className="max-w-xs text-[12px] text-doqyn-muted">
              Os arquivos entram na fila de upload com análise e revisão.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
