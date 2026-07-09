import type { DocumentListItem } from '@/types/document-library';
import { DocumentFilesGrid } from './files/DocumentFilesGrid';

type FileGridViewProps = {
  documents: DocumentListItem[];
  variant?: 'default' | 'explorer';
};

/** Modo grade — grade compacta com DocumentFileCard unificado. */
export function FileGridView({ documents, variant = 'explorer' }: FileGridViewProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-1 py-1" data-testid="file-grid-view">
      <DocumentFilesGrid documents={documents} showStatus={variant === 'default'} />
    </div>
  );
}
