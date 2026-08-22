import type { AnalyzePdfResponse, AnalyzePdfUpdateResponse } from '../../ai/types/documentAi.types.js';

export type AnalysisJobKind = 'initial' | 'version_update';

export type AnalysisJobResult = AnalyzePdfResponse | AnalyzePdfUpdateResponse;

export type AnalysisJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'requires_review'
  | 'ai_unavailable'
  | 'failed';

export type MongoAnalysisJob = {
  _id: string;
  tenantId: string;
  ownerUserId: string;
  status: AnalysisJobStatus;
  originalFileName: string;
  mimeType: string;
  fileHash: string;
  fileSizeBytes: number;
  stagingKey?: string;
  requestId?: string;
  batchId?: string;
  itemId?: string;
  jobKind?: AnalysisJobKind;
  documentId?: string;
  membershipId?: string;
  progress?: number;
  result?: AnalysisJobResult | null;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export type AnalysisQueueJobPayload = {
  jobId: string;
  tenantId: string;
  ownerUserId: string;
  originalFileName: string;
  mimeType: string;
  fileHash: string;
  fileSizeBytes: number;
  stagingKey?: string;
  requestId?: string;
  batchId?: string;
  itemId?: string;
  jobKind?: AnalysisJobKind;
  documentId?: string;
  membershipId?: string;
  /**
   * Quantas vezes o job já voltou para a fila por saturação da vazão da Groq. Vive no payload
   * (Redis) porque `moveToDelayed` não consome tentativa do BullMQ.
   */
  saturationRequeues?: number;
};

export type AnalysisJobPollResponse = {
  jobId: string;
  status: AnalysisJobStatus;
  progress?: number;
  pollUrl: string;
  result?: AnalysisJobResult;
  errorCode?: string;
  errorMessage?: string;
  /**
   * Quantos documentos estão na frente deste na fila da plataforma. `0` é "já está sendo
   * analisado". Ausente quando o job saiu da fila.
   *
   * A conta é global, não do tenant: a fila é da plataforma inteira e o gargalo é a vazão da conta
   * de IA. Uma posição contada só dentro do próprio tenant mentiria sobre a espera.
   */
  queuePosition?: number;
  /**
   * Espera estimada em segundos, a partir da vazão observada nos últimos minutos. `null` quando não
   * houve conclusão recente para medir — inventar número é pior que não mostrar nenhum.
   */
  estimatedWaitSeconds?: number | null;
};

export type AnalysisEnqueueResponse = {
  jobId: string;
  status: 'queued';
  pollUrl: string;
};
