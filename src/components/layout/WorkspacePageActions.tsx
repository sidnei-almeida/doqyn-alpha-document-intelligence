import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WorkspacePageActionsProps = {
  children: ReactNode;
  className?: string;
};

/** Grupo de ações do header — alinhamento e espaçamento consistentes em todas as telas. */
export function WorkspacePageActions({ children, className }: WorkspacePageActionsProps) {
  return (
    <div
      className={cn('workspace-page-actions flex shrink-0 items-center gap-0.5', className)}
      data-testid="workspace-page-actions"
    >
      {children}
    </div>
  );
}
