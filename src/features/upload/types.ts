import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import type { ExtractedMetadata } from '@/features/document-send/types';
import type { AnalysisQueueStatus, AnalyzePdfResponse } from './services/analyzePdf';

export type UploadQueueItemStatus =
  | 'queued'
  | 'analyzing'
  | 'review'
  | 'confirming'
  | 'awaiting_approval'
  | 'ai_paused'
  | 'done'
  | 'error';

/** Contexto de onde o upload foi iniciado (espaço/categoria aberto na Biblioteca). */
export type UploadContext = {
  categoryId?: string;
  categoryName?: string;
};

export type UploadQueueItemAnalysis = {
  metadata: ExtractedMetadata;
  raw: AnalyzePdfResponse;
};

export type UploadQueueItem = {
  id: string;
  fileName: string;
  fileSize: number;
  status: UploadQueueItemStatus;
  context?: UploadContext;
  analysis?: UploadQueueItemAnalysis;
  documentId?: string;
  approvalId?: string;
  errorMessage?: string;
  /** Escolha de nomeação por arquivo (quando policy = ask_each_file ou revisão manual). */
  namingChoice?: PerItemNamingChoice;
  /** Onde o documento está na fila da plataforma, atualizado a cada consulta de status. */
  queueStatus?: AnalysisQueueStatus;
};
