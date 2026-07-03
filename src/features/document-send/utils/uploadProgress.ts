import type { SendFlowPhase } from '../types';
import type { BulkBatchPhase, BulkUploadItem, BulkUploadItemStatus } from '../types/bulk';

export type UploadProgressStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'uploaded'
  | 'analyzing'
  | 'review_required'
  | 'confirming'
  | 'completed'
  | 'failed';

export type UploadProgressViewModel = {
  status: UploadProgressStatus;
  percent: number;
  label: string;
  message: string;
  fileName?: string;
  fileSize?: number;
  errorMessage?: string;
  recentSteps?: string[];
  documentId?: string;
};

const STATUS_PERCENT: Record<UploadProgressStatus, number> = {
  idle: 0,
  preparing: 10,
  uploading: 25,
  uploaded: 40,
  analyzing: 60,
  review_required: 75,
  confirming: 90,
  completed: 100,
  failed: 0,
};

const STATUS_LABEL: Record<UploadProgressStatus, string> = {
  idle: 'Aguardando arquivo',
  preparing: 'Preparando envio',
  uploading: 'Enviando documento',
  uploaded: 'Upload concluído',
  analyzing: 'Analisando com IA',
  review_required: 'Aguardando revisão',
  confirming: 'Salvando documento',
  completed: 'Concluído',
  failed: 'Erro no envio',
};

const STATUS_MESSAGE: Record<UploadProgressStatus, string> = {
  idle: 'Selecione um documento para iniciar o envio.',
  preparing: 'Pronto para enviar.',
  uploading: 'Seu arquivo será analisado automaticamente.',
  uploaded: 'Arquivo recebido. Iniciando análise.',
  analyzing: 'Estamos extraindo informações do documento.',
  review_required: 'Revise os metadados antes de salvar.',
  confirming: 'Gravando documento e metadados.',
  completed: 'Documento salvo com sucesso.',
  failed: 'Não foi possível concluir o envio. Tente novamente.',
};

export function getUploadProgressPercent(
  status: UploadProgressStatus,
  dynamicPercent?: number,
): number {
  if (status === 'failed') {
    return dynamicPercent !== undefined ? Math.min(99, Math.max(5, dynamicPercent)) : 40;
  }

  if (status === 'analyzing' && dynamicPercent !== undefined) {
    return Math.min(89, Math.max(STATUS_PERCENT.analyzing, dynamicPercent));
  }

  if (status === 'confirming' && dynamicPercent !== undefined) {
    return Math.min(99, Math.max(STATUS_PERCENT.confirming, dynamicPercent));
  }

  return STATUS_PERCENT[status];
}

export function getUploadProgressLabel(status: UploadProgressStatus): string {
  return STATUS_LABEL[status];
}

export function getUploadProgressMessage(
  status: UploadProgressStatus,
  overrides?: { message?: string; errorMessage?: string },
): string {
  if (status === 'failed' && overrides?.errorMessage) {
    return overrides.errorMessage;
  }
  return overrides?.message ?? STATUS_MESSAGE[status];
}

function mapBulkItemStatus(status: BulkUploadItemStatus): UploadProgressStatus {
  switch (status) {
    case 'queued':
      return 'preparing';
    case 'analyzing':
      return 'analyzing';
    case 'analyzed':
    case 'auto_countdown':
    case 'requires_review':
    case 'ai_paused':
    case 'unclassified':
      return 'review_required';
    case 'saving':
      return 'confirming';
    case 'saved':
      return 'completed';
    case 'error':
      return 'failed';
    case 'skipped':
      return 'idle';
    default:
      return 'preparing';
  }
}

export function deriveBulkUploadProgressState(input: {
  batchPhase: BulkBatchPhase;
  currentItem: BulkUploadItem | null;
  statusMessage?: string | null;
  itemsCount?: number;
}): UploadProgressViewModel {
  const { batchPhase, currentItem, statusMessage, itemsCount = 0 } = input;

  if (batchPhase === 'idle' || itemsCount === 0) {
    return {
      status: 'idle',
      percent: 0,
      label: getUploadProgressLabel('idle'),
      message: 'Selecione documentos para iniciar o envio em lote.',
    };
  }

  if (batchPhase === 'completed') {
    return {
      status: 'completed',
      percent: 100,
      label: 'Lote concluído',
      message: statusMessage ?? 'Todos os arquivos do lote foram processados.',
      fileName: currentItem?.originalFileName,
      fileSize: currentItem?.sizeBytes,
      documentId: currentItem?.documentId,
    };
  }

  if (batchPhase === 'cancelled') {
    return {
      status: 'failed',
      percent: 40,
      label: 'Lote cancelado',
      message: statusMessage ?? 'O processamento em lote foi interrompido.',
      fileName: currentItem?.originalFileName,
      fileSize: currentItem?.sizeBytes,
    };
  }

  if (!currentItem) {
    return {
      status: 'preparing',
      percent: STATUS_PERCENT.preparing,
      label: getUploadProgressLabel('preparing'),
      message: statusMessage ?? 'Preparando próximo arquivo do lote.',
    };
  }

  const status = mapBulkItemStatus(currentItem.status);
  const percent = getUploadProgressPercent(status);

  return {
    status,
    percent,
    label: getUploadProgressLabel(status),
    message:
      currentItem.errorMessage ??
      statusMessage ??
      getUploadProgressMessage(status),
    fileName: currentItem.originalFileName,
    fileSize: currentItem.sizeBytes,
    errorMessage: currentItem.errorMessage,
    documentId: currentItem.documentId,
    recentSteps: currentItem.logs.slice(-3),
  };
}

export function deriveSingleFileUploadProgressState(input: {
  flowPhase: SendFlowPhase;
  fileName?: string;
  fileSize?: number;
  requiresReview?: boolean;
  dynamicPercent?: number;
  errorMessage?: string;
  documentId?: string | null;
  recentLogLabels?: string[];
}): UploadProgressViewModel {
  const {
    flowPhase,
    fileName,
    fileSize,
    requiresReview,
    dynamicPercent,
    errorMessage,
    documentId,
    recentLogLabels,
  } = input;

  let status: UploadProgressStatus = 'idle';

  switch (flowPhase) {
    case 'idle':
      status = 'idle';
      break;
    case 'analyzing':
      status = 'analyzing';
      break;
    case 'completing':
      status = 'analyzing';
      break;
    case 'completed':
      status = 'review_required';
      break;
    case 'saving':
      status = 'confirming';
      break;
    case 'saved':
      status = 'completed';
      break;
    case 'error':
      status = 'failed';
      break;
    default:
      status = 'idle';
  }

  if (flowPhase === 'completed' && !requiresReview) {
    status = 'review_required';
  }

  let message = getUploadProgressMessage(status, { errorMessage });
  if (flowPhase === 'idle' && fileName) {
    message = 'Pronto para enviar.';
    status = 'preparing';
  }
  if (flowPhase === 'completing') {
    message = 'Análise concluída. Preparando resultado.';
  }

  const percent = getUploadProgressPercent(
    status,
    flowPhase === 'analyzing' || flowPhase === 'completing' ? dynamicPercent : undefined,
  );

  return {
    status,
    percent,
    label: getUploadProgressLabel(status),
    message,
    fileName,
    fileSize,
    errorMessage: status === 'failed' ? errorMessage : undefined,
    documentId: documentId ?? undefined,
    recentSteps: recentLogLabels?.slice(-3),
  };
}

export function buildTrackingHref(documentId?: string, requestId?: string): string | null {
  if (documentId?.trim()) {
    return `/tracking?documentId=${encodeURIComponent(documentId.trim())}`;
  }
  if (requestId?.trim()) {
    return `/tracking?requestId=${encodeURIComponent(requestId.trim())}`;
  }
  return null;
}
