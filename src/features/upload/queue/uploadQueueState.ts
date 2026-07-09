import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import type { UploadQueueItem, UploadQueueItemAnalysis, UploadQueueItemStatus } from '../types';

export type UploadQueueAction =
  | { type: 'enqueue'; items: UploadQueueItem[] }
  | { type: 'status'; id: string; status: UploadQueueItemStatus }
  | { type: 'analysis'; id: string; analysis: UploadQueueItemAnalysis }
  | { type: 'done'; id: string; documentId: string }
  | { type: 'error'; id: string; message: string }
  | { type: 'retry'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear-finished' }
  | { type: 'naming'; id: string; choice: PerItemNamingChoice };

export function uploadQueueReducer(
  items: UploadQueueItem[],
  action: UploadQueueAction,
): UploadQueueItem[] {
  switch (action.type) {
    case 'enqueue':
      return [...items, ...action.items];
    case 'status':
      return items.map((item) =>
        item.id === action.id ? { ...item, status: action.status } : item,
      );
    case 'analysis':
      return items.map((item) =>
        item.id === action.id ? { ...item, analysis: action.analysis } : item,
      );
    case 'done':
      return items.map((item) =>
        item.id === action.id
          ? { ...item, status: 'done' as const, documentId: action.documentId, errorMessage: undefined }
          : item,
      );
    case 'error':
      return items.map((item) =>
        item.id === action.id
          ? { ...item, status: 'error' as const, errorMessage: action.message }
          : item,
      );
    case 'retry':
      return items.map((item) =>
        item.id === action.id && item.status === 'error'
          ? { ...item, status: 'queued' as const, errorMessage: undefined, analysis: undefined }
          : item,
      );
    case 'remove':
      return items.filter((item) => item.id !== action.id);
    case 'clear-finished':
      return items.filter((item) => item.status !== 'done');
    case 'naming':
      return items.map((item) =>
        item.id === action.id ? { ...item, namingChoice: action.choice } : item,
      );
    default:
      return items;
  }
}

export function nextQueuedItem(items: UploadQueueItem[]): UploadQueueItem | null {
  return items.find((item) => item.status === 'queued') ?? null;
}

/** A fila processa um arquivo por vez: análise e confirmação não rodam em paralelo. */
export function hasActiveItem(items: UploadQueueItem[]): boolean {
  return items.some((item) => item.status === 'analyzing' || item.status === 'confirming');
}

export function countPendingItems(items: UploadQueueItem[]): number {
  return items.filter((item) => item.status !== 'done' && item.status !== 'error').length;
}

/** Itens salvos no Mongo após confirmAnalysis 201. */
export function countSavedDocuments(items: UploadQueueItem[]): number {
  return items.filter((item) => item.status === 'done' && Boolean(item.documentId)).length;
}

export function countAwaitingReview(items: UploadQueueItem[]): number {
  return items.filter((item) => item.status === 'review').length;
}

export function isItemSavedInLibrary(item: UploadQueueItem): boolean {
  return item.status === 'done' && Boolean(item.documentId);
}
