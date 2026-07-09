import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

type AuditEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
};

export function AuditEmptyState({ icon, title, description, className }: AuditEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className={className}
      stretch
    />
  );
}
