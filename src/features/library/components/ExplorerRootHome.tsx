import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder, LibraryViewMode } from '../types/library';
import { ExplorerFolderGrid } from './ExplorerFolderGrid';
import { ExplorerHomeSection } from './ExplorerHomeSection';
import { ExplorerRootEmpty } from './ExplorerRootEmpty';
import { ExplorerRecentList } from './ExplorerRecentList';
import { ExplorerFileListScope } from '../context/ExplorerActionsContext';
import { DocumentFilesGrid } from './files/DocumentFilesGrid';
import { DocumentFileRow } from './files/DocumentFileRow';
import { formatDate } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type ExplorerRootHomeProps = {
  folders: LibraryFolder[];
  recentDocuments: DocumentListItem[];
  uncategorizedDocuments: DocumentListItem[];
  totalDocumentCount: number;
  viewMode: LibraryViewMode;
  onOpenFolder: (folder: LibraryFolder) => void;
  onFolderContextMenu: (folder: LibraryFolder, x: number, y: number) => void;
  onFolderInfo?: (folder: LibraryFolder) => void;
  onUploadClick: () => void;
};

/**
 * Home da Biblioteca na raiz — pastas inteligentes, recentes em grade/lista
 * e seção opcional sem categoria. Visual de file manager, não dashboard.
 */
export function ExplorerRootHome({
  folders,
  recentDocuments,
  uncategorizedDocuments,
  totalDocumentCount,
  viewMode,
  onOpenFolder,
  onFolderContextMenu,
  onFolderInfo,
  onUploadClick,
}: ExplorerRootHomeProps) {
  const { t } = useTranslation('library');

  const isEmpty =
    folders.length === 0 && recentDocuments.length === 0 && uncategorizedDocuments.length === 0;

  if (isEmpty) return <ExplorerRootEmpty />;

  const uncategorizedOrderedIds = uncategorizedDocuments.map((doc) => doc.documentId);

  return (
    <div
      className="explorer-root-home flex min-h-full flex-1 flex-col gap-7 pb-4"
      data-testid="explorer-root-home"
    >
      <ExplorerFolderGrid
        folders={folders}
        viewMode={viewMode}
        onOpenFolder={onOpenFolder}
        onFolderContextMenu={onFolderContextMenu}
        onFolderInfo={onFolderInfo}
      />

      <ExplorerRecentList
        documents={recentDocuments}
        viewMode={viewMode}
        totalCount={totalDocumentCount}
        onUploadClick={onUploadClick}
      />

      {uncategorizedDocuments.length > 0 && (
        <ExplorerHomeSection
          title={t('explorerRootHome.semCategoria')}
          data-testid="explorer-uncategorized-list"
        >
          <ExplorerFileListScope orderedIds={uncategorizedOrderedIds}>
            {viewMode === 'grid' ? (
              <DocumentFilesGrid
                documents={uncategorizedDocuments}
                metaForDocument={(doc) =>
                  t('explorerRootHome.noFolderMeta', { date: formatDate(doc.updatedAt) })
                }
                testId="explorer-uncategorized-grid"
              />
            ) : (
              <div className="flex flex-col gap-0.5">
                {uncategorizedDocuments.map((doc) => (
                  <DocumentFileRow
                    key={doc.documentId}
                    document={doc}
                    meta={t('explorerRootHome.noFolderMeta', { date: formatDate(doc.updatedAt) })}
                    layout="compact"
                  />
                ))}
              </div>
            )}
          </ExplorerFileListScope>
        </ExplorerHomeSection>
      )}
    </div>
  );
}
