import { useMemo } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import { ExplorerFileListScope } from '../../context/ExplorerActionsContext';
import { DocumentFileCard } from './DocumentFileCard';

type DocumentFilesGridProps = {
  documents: DocumentListItem[];
  /** Metadado customizado por documento. */
  metaForDocument?: (doc: DocumentListItem) => string | undefined;
  showStatus?: boolean;
  testId?: string;
};

/**
 * Grade compacta de arquivos — colunas fixas (200–240px) para cards proporcionais.
 * Usada em raiz, pastas, recentes e coleções.
 */
export function DocumentFilesGrid({
  documents,
  metaForDocument,
  showStatus = false,
  testId = 'document-files-grid',
}: DocumentFilesGridProps) {
  const orderedIds = useMemo(
    () => documents.map((doc) => doc.documentId),
    [documents],
  );

  return (
    <ExplorerFileListScope orderedIds={orderedIds}>
      <div className="document-files-grid" data-testid={testId}>
        {documents.map((doc) => (
          <DocumentFileCard
            key={doc.documentId}
            document={doc}
            meta={metaForDocument?.(doc)}
            showStatus={showStatus}
          />
        ))}
      </div>
    </ExplorerFileListScope>
  );
}
