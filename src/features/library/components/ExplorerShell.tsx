import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ExplorerShellProps = {
  header: ReactNode;
  toolbar?: ReactNode;
  content: ReactNode;
  /** Raiz do explorer: pastas em tela cheia, sem sensação de dashboard. */
  variant?: 'explorer-root' | 'explorer-folder' | 'default';
};

/**
 * Shell do File Explorer — área principal em largura total, sem painel lateral fixo.
 */
export function ExplorerShell({
  header,
  toolbar,
  content,
  variant = 'default',
}: ExplorerShellProps) {
  return (
    <div
      className={cn(
        'library-shell explorer-shell flex min-h-0 w-full flex-1 flex-col',
        variant === 'explorer-root' && 'explorer-shell--root',
        variant === 'explorer-folder' && 'explorer-shell--folder',
      )}
      data-testid="library-shell"
    >
      <div className="library-main workspace-enter flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <header className="library-header explorer-header shrink-0 pb-3">{header}</header>

        <div
          className={cn(
            'library-content-area relative min-h-0 w-full flex-1',
            variant === 'explorer-root' && 'min-h-[min(560px,68vh)]',
            variant === 'explorer-folder' && 'min-h-[min(400px,60vh)]',
          )}
        >
          {toolbar && (
            <div className="library-toolbar explorer-toolbar-floating menu-enter absolute inset-x-0 top-0 z-20 shadow-elevation-2">
              {toolbar}
            </div>
          )}

          <div className="library-content explorer-content flex h-full min-h-0 w-full flex-1 flex-col">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ExplorerShell — alias para transição. */
export const LibraryShell = ExplorerShell;
