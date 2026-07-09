import type { DocumentListItem } from '@/types/document-library';
import type { LibrarySortDirection, LibrarySortKey } from '../types/library';

function documentDisplayName(doc: DocumentListItem): string {
  return doc.currentFileName ?? doc.displayName ?? '';
}

function documentOwnerName(doc: DocumentListItem): string {
  return doc.createdBy?.displayName ?? doc.ownerName ?? '';
}

export function sortDocuments(
  documents: DocumentListItem[],
  sortKey: LibrarySortKey,
  direction: LibrarySortDirection = 'desc',
): DocumentListItem[] {
  const sorted = [...documents];
  const factor = direction === 'asc' ? 1 : -1;

  switch (sortKey) {
    case 'name':
      sorted.sort(
        (a, b) =>
          factor * documentDisplayName(a).localeCompare(documentDisplayName(b), 'pt-BR'),
      );
      break;
    case 'status':
      sorted.sort(
        (a, b) => factor * (a.status ?? '').localeCompare(b.status ?? '', 'pt-BR'),
      );
      break;
    case 'owner':
      sorted.sort(
        (a, b) =>
          factor * documentOwnerName(a).localeCompare(documentOwnerName(b), 'pt-BR'),
      );
      break;
    case 'category':
      sorted.sort(
        (a, b) =>
          factor * (a.categoryName ?? '').localeCompare(b.categoryName ?? '', 'pt-BR'),
      );
      break;
    case 'updatedAt':
    default:
      sorted.sort(
        (a, b) =>
          factor *
          (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
      );
      break;
  }
  return sorted;
}
