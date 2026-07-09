import type { DocumentListItem } from '@/types/document-library';
import { DocumentFileRow } from './files/DocumentFileRow';

type ExplorerFileCompactRowProps = {
  document: DocumentListItem;
  meta?: string;
};

/** @deprecated Use DocumentFileRow — alias para listas compactas. */
export function ExplorerFileCompactRow({ document: doc, meta }: ExplorerFileCompactRowProps) {
  return <DocumentFileRow document={doc} meta={meta} layout="compact" />;
}

export type { DocumentListItem };
