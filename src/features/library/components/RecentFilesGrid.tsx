import type { DocumentListItem } from '@/types/document-library';
import { DocumentFilesGrid } from './files/DocumentFilesGrid';

type RecentFilesGridProps = {
  documents: DocumentListItem[];
};

/** @deprecated Use DocumentFilesGrid — alias para recentes na home. */
export function RecentFilesGrid({ documents }: RecentFilesGridProps) {
  return <DocumentFilesGrid documents={documents} testId="recent-files-grid" />;
}
