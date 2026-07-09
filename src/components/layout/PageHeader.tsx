import type { ReactNode } from 'react';
import { WorkspacePageHeader } from './WorkspacePageHeader';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

/** @deprecated Prefer WorkspacePageHeader — mantido para compatibilidade. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <WorkspacePageHeader
      className={className}
      eyebrow={eyebrow}
      title={title}
      subtitle={description}
      actions={actions}
    />
  );
}
