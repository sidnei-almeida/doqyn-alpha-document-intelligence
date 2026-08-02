import { formatTime } from '@/lib/formatLocale';
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
import {
  getAutoSaveBlockers,
  resolveAnalysisOutcome,
} from '../../upload/queue/uploadQueueCore';

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

export function summarizeWorkflowLogMessage(event: {
  level: string;
  stage: string;
  message: string;
  details?: Record<string, unknown>;
}): string {
  const friendly = event.details?.friendlyTitle;
  if (typeof friendly === 'string' && friendly.trim()) return friendly.trim();
  return event.message;
}

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
  return formatTime(date, {
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
  const outcome = resolveAnalysisOutcome(metadata, raw);
  const blockers = getAutoSaveBlockers({
    isAuthenticated: true,
    metadata,
    rawAnalysis: raw,
  });

  const reasons = [...blockers];
  const details: Record<string, unknown> = {
    confidence: raw.classification.confidence,
    className: raw.classification.className,
    requiresReview: raw.classification.requiresReview,
    analysisStatus: metadata.analysisStatus,
    missingFields: metadata.missingFields ?? raw.extraction?.missingFields ?? [],
    recommendedFileName: raw.recommendedFileName,
  };

  if (outcome.status === 'ai_paused') {
    return {
      action: 'error',
      reasons: outcome.classificationError ? [outcome.classificationError] : reasons,
      details: { ...details, errorCode: 'GROQ_RATE_LIMIT' },
    };
  }

  if (outcome.status === 'failed') {
    return {
      action: 'error',
      reasons: outcome.classificationError ? [outcome.classificationError] : reasons,
      details,
    };
  }

  if (raw.classification.confidence < MIN_CLASSIFICATION_CONFIDENCE) {
    const confidenceReason = `Confiança abaixo do mínimo configurado (${Math.round(raw.classification.confidence * 100)}%).`;
    if (!reasons.includes(confidenceReason)) {
      reasons.push(confidenceReason);
    }
  }

  if (outcome.status === 'requires_review' || reasons.length > 0) {
    return {
      action: 'review',
      reasons: reasons.length > 0 ? reasons : ['Revisão necessária antes do salvamento.'],
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
