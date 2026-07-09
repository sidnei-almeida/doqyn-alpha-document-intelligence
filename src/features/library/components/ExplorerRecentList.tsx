import { Link } from 'react-router-dom';
import type { DocumentListItem } from '@/types/document-library';
import type { LibraryViewMode } from '../types/library';
import { ExplorerFileListScope } from '../context/ExplorerActionsContext';
import { ExplorerHomeSection } from './ExplorerHomeSection';
import { RecentEmptyState } from './RecentEmptyState';
import { DocumentFileRow } from './files/DocumentFileRow';
import { DocumentFilesGrid } from './files/DocumentFilesGrid';

type ExplorerRecentListProps = {
  documents: DocumentListItem[];
  viewMode: LibraryViewMode;
  totalCount?: number;
  onUploadClick: () => void;
};

/** Seção de arquivos recentes na home — grade ou lista leve, nunca tabela administrativa. */
export function ExplorerRecentList({
  documents,
  viewMode,
  totalCount,
  onUploadClick,
}: ExplorerRecentListProps) {
  const showMoreLink = totalCount != null && totalCount > documents.length;
  const orderedIds = documents.map((doc) => doc.documentId);

  return (
    <ExplorerHomeSection
      title="Recentes"
      data-testid="explorer-recent-list"
      action={
        showMoreLink ? (
          <Link
            to="/biblioteca/recentes"
            className="shrink-0 text-[12px] font-medium text-doqyn-accent-active hover:underline"
          >
            Ver todos
          </Link>
        ) : undefined
      }
    >
      {documents.length === 0 ? (
        <RecentEmptyState onUploadClick={onUploadClick} />
      ) : (
        <ExplorerFileListScope orderedIds={orderedIds}>
          {viewMode === 'grid' ? (
            <DocumentFilesGrid documents={documents} testId="recent-files-grid" />
          ) : (
            <div className="flex flex-col gap-0.5">
              {documents.map((doc) => (
                <DocumentFileRow key={doc.documentId} document={doc} layout="compact" />
              ))}
            </div>
          )}
        </ExplorerFileListScope>
      )}
    </ExplorerHomeSection>
  );
}
