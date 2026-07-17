import type { DocumentListItem } from '@/types/document-library';
import { localeCompareActive } from '@/lib/formatLocale';
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
          factor * localeCompareActive(documentDisplayName(a), documentDisplayName(b)),
      );
      break;
    case 'status':
      sorted.sort(
        (a, b) => factor * localeCompareActive(a.status ?? '', b.status ?? ''),
      );
      break;
    case 'owner':
      sorted.sort(
        (a, b) =>
          factor * localeCompareActive(documentOwnerName(a), documentOwnerName(b)),
      );
      break;
    case 'category':
      sorted.sort(
        (a, b) =>
          factor * localeCompareActive(a.categoryName ?? '', b.categoryName ?? ''),
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
