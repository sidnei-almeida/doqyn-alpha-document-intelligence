import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

type AuditEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  className?: string;
};

/**
 * Vazio da auditoria. Sem ícone por padrão: o `EmptyState` marca com o fio
 * curto acima do título, e um pictograma grande no meio da tela só repetia em
 * desenho o que a frase já diz.
 */
export function AuditEmptyState({ icon, title, description, className }: AuditEmptyStateProps) {
  return (
    <EmptyState icon={icon} title={title} description={description} className={className} stretch />
  );
}
