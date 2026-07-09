import { useMemo } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import { ExplorerFileListScope } from '../context/ExplorerActionsContext';
import { FileRow } from './FileRow';
import { FileGridView } from './FileGridView';
import type { LibraryViewMode } from '../types/library';

type ExplorerFolderFilesProps = {
  documents: DocumentListItem[];
  viewMode: LibraryViewMode;
};

const HEADER_CELL = 'px-3 py-1.5 text-left font-normal';

/**
 * Área de arquivos dentro de uma pasta — lista/grade sem cara de tabela administrativa.
 */
export function ExplorerFolderFiles({ documents, viewMode }: ExplorerFolderFilesProps) {
  const orderedIds = useMemo(
    () => documents.map((doc) => doc.documentId),
    [documents],
  );

  if (viewMode === 'grid') {
    return (
      <div className="explorer-folder-files min-h-0 flex-1" data-testid="explorer-folder-files-grid">
        <FileGridView documents={documents} variant="explorer" />
      </div>
    );
  }

  return (
    <ExplorerFileListScope orderedIds={orderedIds}>
      <div
        className="explorer-folder-files flex min-h-0 flex-1 flex-col"
        data-testid="library-file-table"
      >
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <table className="explorer-row-gap w-full" aria-label="Arquivos da pasta">
            <thead>
              <tr className="text-[11px] font-normal text-doqyn-subtle">
                <th scope="col" className={HEADER_CELL}>
                  Nome
                </th>
                <th scope="col" className={`${HEADER_CELL} hidden md:table-cell w-[140px]`}>
                  Modificado
                </th>
                <th scope="col" className={`${HEADER_CELL} hidden sm:table-cell w-[100px]`}>
                  Status
                </th>
                <th scope="col" className={`${HEADER_CELL} w-10`}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <FileRow key={doc.documentId} document={doc} variant="explorer" />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ExplorerFileListScope>
  );
}

/** Placeholder de carregamento — silhueta de lista explorador. */
export function FileTableSkeleton() {
  return (
    <div
      className="min-h-0 flex-1 overflow-hidden"
      role="status"
      aria-label="Carregando documentos"
      data-testid="explorer-folder-files-skeleton"
    >
      <div className="space-y-1 px-1">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="skeleton-line h-8 w-8 rounded-md bg-doqyn-card" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton-line h-3 w-2/5 rounded bg-doqyn-card" />
              <div className="skeleton-line h-2.5 w-1/4 rounded bg-doqyn-card" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
