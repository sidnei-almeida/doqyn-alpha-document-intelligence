import type { DocumentListItem } from '@/types/document-library';
import { DocumentFileCard } from './files/DocumentFileCard';

type FileGridCardProps = {
  document: DocumentListItem;
  variant?: 'default' | 'explorer';
};

/** @deprecated Use DocumentFileCard — alias de compatibilidade. */
export function FileGridCard({ document: doc, variant = 'explorer' }: FileGridCardProps) {
  return <DocumentFileCard document={doc} showStatus={variant === 'default'} />;
}
