import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import type { AnalysisQueueStatus } from '../services/analyzePdf';
import type { UploadQueueItem, UploadQueueItemAnalysis, UploadQueueItemStatus } from '../types';
import {
  findNextQueuedItem,
  findNextQueuedItemExcluding,
  hasInFlightUploadItem,
} from './uploadQueueCore';

export type UploadQueueAction =
  | { type: 'enqueue'; items: UploadQueueItem[] }
  | { type: 'status'; id: string; status: UploadQueueItemStatus }
  | { type: 'queue_status'; id: string; queueStatus: AnalysisQueueStatus }
  | { type: 'analysis'; id: string; analysis: UploadQueueItemAnalysis }
  | { type: 'done'; id: string; documentId: string }
  | { type: 'awaiting_approval'; id: string; approvalId: string }
  | { type: 'error'; id: string; message: string }
  | { type: 'ai_pause'; id: string; message: string }
  | { type: 'still_running'; id: string; message: string }
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
    case 'queue_status':
      return items.map((item) =>
        item.id === action.id ? { ...item, queueStatus: action.queueStatus } : item,
      );
    case 'analysis':
      return items.map((item) =>
        // O lugar na fila deixa de valer no instante em que o resultado chega.
        item.id === action.id
          ? { ...item, analysis: action.analysis, queueStatus: undefined }
          : item,
      );
    case 'done':
      return items.map((item) =>
        item.id === action.id
          ? { ...item, status: 'done' as const, documentId: action.documentId, errorMessage: undefined }
          : item,
      );
    case 'awaiting_approval':
      return items.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: 'awaiting_approval' as const,
              approvalId: action.approvalId,
              errorMessage: undefined,
            }
          : item,
      );
    case 'error':
      return items.map((item) =>
        item.id === action.id
          ? { ...item, status: 'error' as const, errorMessage: action.message }
          : item,
      );
    case 'ai_pause':
      return items.map((item) =>
        item.id === action.id
          ? { ...item, status: 'ai_paused' as const, errorMessage: action.message }
          : item,
      );
    case 'still_running':
      return items.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: 'still_running' as const,
              errorMessage: action.message,
              queueStatus: undefined,
            }
          : item,
      );
    case 'retry':
      return items.map((item) =>
        // `still_running` também aceita reenvio manual: é decisão de quem está olhando a tela, e
        // aqui ele sabe que pode gerar duplicata. O caminho automático nunca reenvia sozinho.
        item.id === action.id &&
        (item.status === 'error' ||
          item.status === 'ai_paused' ||
          item.status === 'still_running')
          ? { ...item, status: 'queued' as const, errorMessage: undefined, analysis: undefined }
          : item,
      );
    case 'remove':
      return items.filter((item) => item.id !== action.id);
    case 'clear-finished':
      return items.filter(
        (item) => item.status !== 'done' && item.status !== 'awaiting_approval',
      );
    case 'naming':
      return items.map((item) =>
        item.id === action.id ? { ...item, namingChoice: action.choice } : item,
      );
    default:
      return items;
  }
}

/** Próximo item enfileirado ainda não iniciado. */
export function nextQueuedItem(items: UploadQueueItem[]): UploadQueueItem | null {
  return findNextQueuedItem(items);
}

/** Próximo enfileirado que ainda não foi despachado nesta rodada. */
export function nextQueuedItemExcluding(
  items: UploadQueueItem[],
  excludedIds: ReadonlySet<string>,
): UploadQueueItem | null {
  return findNextQueuedItemExcluding(items, excludedIds);
}

/**
 * Bloqueia o worker da fila enquanto um arquivo ainda não foi persistido ou enviado
 * para aprovação. Garante o pipeline: analisar → salvar/aprovar → próximo.
 */
export function hasActiveItem(items: UploadQueueItem[]): boolean {
  return hasInFlightUploadItem(items);
}

export function countAwaitingApproval(items: UploadQueueItem[]): number {
  return items.filter((item) => item.status === 'awaiting_approval').length;
}

/** Itens concluídos no fluxo: salvos na Biblioteca ou enviados para aprovação. */
export function countSubmittedItems(items: UploadQueueItem[]): number {
  return items.filter(
    (item) =>
      isItemSavedInLibrary(item) || item.status === 'awaiting_approval',
  ).length;
}

export function countPendingItems(items: UploadQueueItem[]): number {
  return items.filter(
    (item) =>
      item.status !== 'done' && item.status !== 'error' && item.status !== 'awaiting_approval',
  ).length;
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
