import { useMemo } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import { ExplorerFileListScope } from '../context/ExplorerActionsContext';
import { FileRow } from './FileRow';

type FileTableProps = {
  documents: DocumentListItem[];
  title?: string;
};

const HEADER_CELL =
  'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-doqyn-subtle';

/** Lista administrativa — usada em busca/coleções virtuais fora da pasta. */
export function FileTable({ documents, title = 'Arquivos' }: FileTableProps) {
  const orderedIds = useMemo(
    () => documents.map((doc) => doc.documentId),
    [documents],
  );

  return (
    <ExplorerFileListScope orderedIds={orderedIds}>
      <div
        className="workspace-enter flex min-h-full flex-1 flex-col overflow-hidden rounded-xl border border-doqyn-border-subtle bg-doqyn-surface"
        data-testid="library-file-table-legacy"
      >
        <div className="flex items-center justify-between border-b border-doqyn-border-subtle px-4 py-2.5">
          <p className="text-[13px] font-medium text-doqyn-text">{title}</p>
          <p className="text-[11px] text-doqyn-subtle">{documents.length} itens</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <table className="w-full border-collapse" aria-label="Arquivos da Biblioteca">
            <thead className="sticky top-0 z-10 bg-doqyn-surface">
              <tr className="border-b border-doqyn-border-subtle">
                <th scope="col" className={HEADER_CELL}>Nome</th>
                <th scope="col" className={`${HEADER_CELL} hidden lg:table-cell`}>Proprietário</th>
                <th scope="col" className={`${HEADER_CELL} hidden lg:table-cell`}>Tags</th>
                <th scope="col" className={`${HEADER_CELL} hidden md:table-cell`}>Atualizado</th>
                <th scope="col" className={`${HEADER_CELL} hidden sm:table-cell`}>Status</th>
                <th scope="col" className={`${HEADER_CELL} text-right`}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <FileRow key={doc.documentId} document={doc} variant="default" />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ExplorerFileListScope>
  );
}

export { FileTableSkeleton } from './ExplorerFolderFiles';
