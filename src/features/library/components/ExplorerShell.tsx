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
export function ExplorerShell({ header, toolbar, content, variant = 'default' }: ExplorerShellProps) {
  return (
    <div
      className={cn(
        'library-shell explorer-shell flex min-h-0 w-full flex-1 flex-col',
        variant === 'explorer-root' && 'explorer-shell--root',
        variant === 'explorer-folder' && 'explorer-shell--folder',
      )}
      data-testid="library-shell"
    >
      <div className="library-main workspace-enter flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <header className="library-header explorer-header shrink-0 pb-3">{header}</header>

        {toolbar && <div className="library-toolbar explorer-toolbar shrink-0 pb-3">{toolbar}</div>}

        <div
          className={cn(
            'library-content explorer-content flex min-h-0 w-full flex-1 flex-col',
            variant === 'explorer-root' && 'min-h-[min(560px,68vh)]',
            variant === 'explorer-folder' && 'min-h-[min(400px,60vh)]',
          )}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ExplorerShell — alias para transição. */
export const LibraryShell = ExplorerShell;
