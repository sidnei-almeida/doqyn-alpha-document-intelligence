import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder, LibraryViewMode } from '../types/library';
import { ExplorerFolderGrid } from './ExplorerFolderGrid';
import { ExplorerHomeSection } from './ExplorerHomeSection';
import { ExplorerRecentList } from './ExplorerRecentList';
import { ExplorerFileListScope } from '../context/ExplorerActionsContext';
import { DocumentFilesGrid } from './files/DocumentFilesGrid';
import { DocumentFileRow } from './files/DocumentFileRow';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

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
  const isEmpty =
    folders.length === 0 && recentDocuments.length === 0 && uncategorizedDocuments.length === 0;

  if (isEmpty) {
    return (
      <div
        className="flex min-h-[min(420px,55vh)] flex-col items-center justify-center px-6 py-16 text-center"
        data-testid="library-root-empty"
      >
        <p className="text-[15px] font-medium text-doqyn-text">Sua biblioteca está pronta</p>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-doqyn-muted">
          Envie documentos para o DOQYN analisar ou configure categorias em Regras para organizar
          por pastas inteligentes.
        </p>
        <Button type="button" variant="primary" size="md" className="mt-6" onClick={onUploadClick}>
          Enviar documento
        </Button>
      </div>
    );
  }

  const uncategorizedOrderedIds = uncategorizedDocuments.map((doc) => doc.documentId);

  return (
    <div className="explorer-root-home flex flex-col gap-7 pb-4" data-testid="explorer-root-home">
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
        <ExplorerHomeSection title="Sem categoria" data-testid="explorer-uncategorized-list">
          <ExplorerFileListScope orderedIds={uncategorizedOrderedIds}>
            {viewMode === 'grid' ? (
              <DocumentFilesGrid
                documents={uncategorizedDocuments}
                metaForDocument={(doc) => `Sem pasta · ${formatDate(doc.updatedAt)}`}
                testId="explorer-uncategorized-grid"
              />
            ) : (
              <div className="flex flex-col gap-0.5">
                {uncategorizedDocuments.map((doc) => (
                  <DocumentFileRow
                    key={doc.documentId}
                    document={doc}
                    meta={`Sem pasta · ${formatDate(doc.updatedAt)}`}
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
