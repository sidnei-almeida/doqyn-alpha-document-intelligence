import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { BulkUploadItem, BulkUploadItemStatus } from '../types/bulk';

const IN_FLIGHT: BulkUploadItemStatus[] = ['analyzing', 'saving', 'auto_countdown'];

export type ActiveAnalysisRequest = {
  itemId: string;
  fileName: string;
  requestId: string;
  batchId: string | null;
};

export type InFlightCounts = {
  analyzing: number;
  saving: number;
  auto_countdown: number;
  total: number;
};

export type IsolationSnapshot = {
  timestamp: string;
  batchId: string | null;
  currentItemId: string | null;
  activeAnalysisRequest: ActiveAnalysisRequest | null;
  hasAbortController: boolean;
  countdownItemId: string | null;
  hasActiveCountdown: boolean;
  workerRunning: boolean;
  inFlight: InFlightCounts;
  currentItemHasResult: boolean;
  currentItemHasFile: boolean;
};

export function normalizeBulkFileName(name: string): string {
  return name.trim().toLowerCase();
}

export function fileNamesMatch(expected: string, actual: string | undefined | null): boolean {
  if (!actual?.trim()) return true;
  return normalizeBulkFileName(expected) === normalizeBulkFileName(actual);
}

export function countInFlightItems(items: BulkUploadItem[]): InFlightCounts {
  const analyzing = items.filter((item) => item.status === 'analyzing').length;
  const saving = items.filter((item) => item.status === 'saving').length;
  const auto_countdown = items.filter((item) => item.status === 'auto_countdown').length;
  return {
    analyzing,
    saving,
    auto_countdown,
    total: analyzing + saving + auto_countdown,
  };
}

export function buildIsolationSnapshot(params: {
  items: BulkUploadItem[];
  batchId: string | null;
  currentItemId: string | null;
  activeAnalysisRequest: ActiveAnalysisRequest | null;
  hasAbortController: boolean;
  countdownItemId: string | null;
  hasActiveCountdown: boolean;
  workerRunning: boolean;
}): IsolationSnapshot {
  const currentItem = params.currentItemId
    ? params.items.find((item) => item.id === params.currentItemId)
    : undefined;

  return {
    timestamp: new Date().toISOString(),
    batchId: params.batchId,
    currentItemId: params.currentItemId,
    activeAnalysisRequest: params.activeAnalysisRequest,
    hasAbortController: params.hasAbortController,
    countdownItemId: params.countdownItemId,
    hasActiveCountdown: params.hasActiveCountdown,
    workerRunning: params.workerRunning,
    inFlight: countInFlightItems(params.items),
    currentItemHasResult: Boolean(currentItem?.result),
    currentItemHasFile: Boolean(currentItem?.file),
  };
}

export type ResponseOwnershipResult = {
  belongsToItem: boolean;
  reasons: string[];
};

export function validateAnalysisResponseOwnership(params: {
  expectedItemId: string;
  expectedFileName: string;
  expectedRequestId: string;
  currentItemId: string | null;
  activeRequest: ActiveAnalysisRequest | null;
  raw: AnalyzePdfResponse;
  responseRequestId: string;
}): ResponseOwnershipResult {
  const reasons: string[] = [];

  if (params.currentItemId !== params.expectedItemId) {
    reasons.push(
      `itemId atual (${params.currentItemId ?? 'nenhum'}) difere do esperado (${params.expectedItemId}).`,
    );
  }

  if (!params.activeRequest || params.activeRequest.itemId !== params.expectedItemId) {
    reasons.push('Não há requisição de análise ativa para este item.');
  } else if (params.activeRequest.requestId !== params.expectedRequestId) {
    reasons.push('requestId não corresponde à requisição ativa.');
  }

  if (!fileNamesMatch(params.expectedFileName, params.raw.originalFileName)) {
    reasons.push(
      `Nome retornado (${params.raw.originalFileName}) difere do enviado (${params.expectedFileName}).`,
    );
  }

  if (params.responseRequestId !== params.expectedRequestId) {
    reasons.push('requestId da resposta não corresponde ao enviado.');
  }

  return {
    belongsToItem: reasons.length === 0,
    reasons,
  };
}

export function hasOtherInFlightItem(items: BulkUploadItem[], itemId: string): boolean {
  return items.some((item) => item.id !== itemId && IN_FLIGHT.includes(item.status));
}
