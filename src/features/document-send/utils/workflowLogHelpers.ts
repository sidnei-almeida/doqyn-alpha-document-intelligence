import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata, ProcessingLogItem } from '../types';
import type {
  WorkflowLogEvent,
  WorkflowLogInput,
  WorkflowLogStage,
  WorkflowRequestContext,
} from '../types/workflowLog';
import { MIN_CLASSIFICATION_CONFIDENCE } from '../uploadConstants';
import { generateDocumentId } from '../mockData';

export const WORKFLOW_LOG_MAX_EVENTS = 500;

export const WORKFLOW_STAGE_LABELS: Record<WorkflowLogStage, string> = {
  queue: 'Fila',
  validation: 'Validação',
  analysis: 'Análise',
  classification: 'Classificação',
  extraction: 'Extração',
  review: 'Revisão',
  auto: 'Auto',
  confirmation: 'Confirmação',
  persistence: 'Persistência',
  history: 'Histórico',
  ui: 'Interface',
  error: 'Erro',
};

let eventCounter = 0;

export function createWorkflowEventId(): string {
  eventCounter += 1;
  return `wf-${Date.now()}-${eventCounter}`;
}

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return createWorkflowEventId();
}

export function formatWorkflowTimestamp(date = new Date()): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return seconds < 60
    ? `${seconds.toFixed(1).replace('.', ',')}s`
    : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function normalizeWorkflowEvent(input: WorkflowLogInput): WorkflowLogEvent {
  return {
    id: input.id ?? createWorkflowEventId(),
    batchId: input.batchId,
    itemId: input.itemId,
    fileName: input.fileName,
    level: input.level,
    stage: input.stage,
    message: input.message,
    details: input.details,
    timestamp: input.timestamp ?? formatWorkflowTimestamp(),
  };
}

export function buildRequestHeaders(
  context?: WorkflowRequestContext,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (context?.requestId) headers['X-DOQYN-Request-Id'] = context.requestId;
  if (context?.batchId) headers['X-DOQYN-Batch-Id'] = context.batchId;
  if (context?.itemId) headers['X-DOQYN-Item-Id'] = context.itemId;
  if (context?.fileName) headers['X-DOQYN-File-Name'] = context.fileName;
  return headers;
}

export function mapProcessingLogsToWorkflowEvents(
  logs: ProcessingLogItem[],
  context: { batchId?: string; itemId?: string; fileName?: string },
): WorkflowLogInput[] {
  return logs.map((log) => ({
    batchId: context.batchId,
    itemId: context.itemId,
    fileName: context.fileName,
    level:
      log.status === 'error'
        ? 'error'
        : log.status === 'done'
          ? 'success'
          : 'info',
    stage: inferStageFromLogTitle(log.title),
    message: log.title,
    details: log.description ? { description: log.description } : undefined,
  }));
}

function inferStageFromLogTitle(title: string): WorkflowLogStage {
  if (title.includes('recebido')) return 'queue';
  if (title.includes('Texto')) return 'analysis';
  if (title.includes('Trechos')) return 'analysis';
  if (title.includes('Classe')) return 'classification';
  if (title.includes('Metadados')) return 'extraction';
  if (title.includes('Revisão')) return 'review';
  if (title.includes('Nome')) return 'extraction';
  if (title.includes('confirmação')) return 'confirmation';
  if (title.includes('Erro')) return 'error';
  return 'analysis';
}

export type AnalysisDecision = {
  action: 'save' | 'review' | 'error';
  reasons: string[];
  details: Record<string, unknown>;
};

export function buildAnalysisDecision(
  raw: AnalyzePdfResponse,
  metadata: ExtractedMetadata,
): AnalysisDecision {
  const reasons: string[] = [];
  const details: Record<string, unknown> = {
    confidence: raw.classification.confidence,
    className: raw.classification.className,
    requiresReview: raw.classification.requiresReview,
    analysisStatus: metadata.analysisStatus,
    missingFields: metadata.missingFields ?? raw.extraction?.missingFields ?? [],
    recommendedFileName: raw.recommendedFileName,
  };

  if (metadata.analysisStatus === 'ai_unavailable' || raw.status === 'ai_unavailable') {
    reasons.push(
      raw.classification.reason ||
        'Limite temporário da análise automática atingido. Aguarde alguns minutos e tente novamente.',
    );
    return { action: 'error', reasons, details: { ...details, errorCode: 'GROQ_RATE_LIMIT' } };
  }

  if (metadata.analysisStatus === 'failed' || raw.status === 'failed') {
    reasons.push('A análise não foi concluída com sucesso.');
    return { action: 'error', reasons, details };
  }

  if (!raw.classification.classId || !raw.classification.className) {
    reasons.push(
      raw.classification.reason ||
        'A análise não retornou identificação de classe para este documento.',
    );
    return { action: 'error', reasons, details };
  }

  if (raw.classification.confidence < MIN_CLASSIFICATION_CONFIDENCE) {
    reasons.push(
      `Confiança abaixo do mínimo configurado (${Math.round(raw.classification.confidence * 100)}%).`,
    );
  }

  if (raw.classification.requiresReview) {
    reasons.push(
      raw.classification.reason || 'Resultado marcado para revisão pela análise.',
    );
  }

  if (raw.extraction?.requiresReview) {
    reasons.push('Alguns metadados precisam de validação.');
  }

  const missingFields = raw.extraction?.missingFields ?? metadata.missingFields ?? [];
  if (missingFields.length > 0) {
    reasons.push(`Campo obrigatório ausente: ${missingFields.join(', ')}.`);
  }

  if (!raw.recommendedFileName?.trim()) {
    reasons.push('Nome sugerido não foi gerado.');
  }

  if (metadata.analysisStatus === 'requires_review' || reasons.length > 0) {
    return {
      action: 'review',
      reasons,
      details: { ...details, action: 'não salvo automaticamente' },
    };
  }

  return {
    action: 'save',
    reasons: ['Documento elegível para salvamento.'],
    details: { ...details, action: 'salvar' },
  };
}

export function createBatchId(): string {
  return generateDocumentId();
}
