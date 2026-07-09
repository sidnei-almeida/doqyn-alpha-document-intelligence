import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder } from '../types/library';

export type SelectionAnchor = { kind: 'file' | 'folder'; id: string };

export function selectRangeIds(orderedIds: string[], anchorId: string, targetId: string): string[] {
  const anchorIdx = orderedIds.indexOf(anchorId);
  const targetIdx = orderedIds.indexOf(targetId);
  if (anchorIdx < 0 || targetIdx < 0) return [targetId];
  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  return orderedIds.slice(start, end + 1);
}

export function toggleIdInSet(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function documentsById(documents: DocumentListItem[]): Map<string, DocumentListItem> {
  return new Map(documents.map((doc) => [doc.documentId, doc]));
}

export function foldersById(folders: LibraryFolder[]): Map<string, LibraryFolder> {
  return new Map(folders.map((folder) => [folder.id, folder]));
}
