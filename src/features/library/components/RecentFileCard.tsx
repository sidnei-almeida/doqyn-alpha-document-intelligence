import type { DocumentListItem } from '@/types/document-library';
import { DocumentFileCard } from './files/DocumentFileCard';

type RecentFileCardProps = {
  document: DocumentListItem;
};

/** @deprecated Use DocumentFileCard — alias para recentes. */
export function RecentFileCard({ document: doc }: RecentFileCardProps) {
  return <DocumentFileCard document={doc} />;
}
