import type { WorkflowRequestContext } from '../types/workflowLog';
import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { buildRequestHeaders, createRequestId } from '../utils/workflowLogHelpers';
import type { ExtractedMetadata, ProcessingLogItem } from '../types';

type EvidenceSnippet = {
  pageNumber?: number;
  snippet: string;
};

type ApiProcessingLogItem = {
  title: string;
  description: string;
  status: 'done' | 'active' | 'pending' | 'error';
};

type ClassificationResult = {
  classId: string | null;
  className: string | null;
  confidence: number;
  requiresReview: boolean;
  reason: string;
  evidence: EvidenceSnippet[];
  errorCode?: string;
  reviewReason?: string;
};

type ExtractedMetadataField = {
  label: string;
  value: string | number | null;
  normalizedValue?: string | number | null;
  confidence: number;
  source: 'document_text';
  evidence?: EvidenceSnippet;
  currency?: string;
};

type MetadataExtractionResult = {
  documentType: string | null;
  version: string;
  metadata: Record<string, ExtractedMetadataField>;
  missingFields: string[];
  requiresReview: boolean;
  reviewReasons: string[];
};

export type AnalyzePdfResponse = {
  jobId: string;
  status: 'completed' | 'requires_review' | 'ai_unavailable' | 'failed';
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  recommendedFileName: string | null;
  textExtraction: {
    status: 'completed' | 'failed';
    pageCount?: number;
    charCount: number;
    truncated: boolean;
  };
  classification: ClassificationResult;
  extraction: MetadataExtractionResult | null;
  logs: ApiProcessingLogItem[];
  errorCode?: string;
};

export type AnalyzePdfOptions = {
  signal?: AbortSignal;
  context?: WorkflowRequestContext;
};

export class AnalyzePdfRequestError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AnalyzePdfRequestError';
    this.code = code;
  }
}

function formatNow(): string {
  const now = new Date();
  return `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function mapApiLogs(logs: ApiProcessingLogItem[]): ProcessingLogItem[] {
  return logs.map((log, index) => ({
    id: `log-${index + 1}`,
    title: log.title,
    description: log.description,
    time: log.status === 'done' ? formatNow() : '',
    status: log.status,
  }));
}

function findMetadataValue(
  metadata: Record<string, ExtractedMetadataField>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const field = metadata[key];
    const raw = field?.normalizedValue ?? field?.value;
    if (raw !== null && raw !== undefined && raw !== '') {
      return String(raw);
    }
  }
  return undefined;
}

function mapToExtractedMetadata(
  response: AnalyzePdfResponse,
  extraction: MetadataExtractionResult | null,
  classification: ClassificationResult,
): ExtractedMetadata {
  const metadata = extraction?.metadata ?? {};
  const supplier = findMetadataValue(metadata, [
    'fornecedor',
    'cnpj_emitente',
    'parte_receptora',
    'parte_reveladora',
  ]);
  const documentDate = findMetadataValue(metadata, [
    'data_assinatura',
    'data_emissao',
    'data_pedido',
  ]);
  const valueField = metadata.valor_total ?? metadata.multa_penalidade;
  const rawValue = valueField?.normalizedValue ?? valueField?.value;
  const value =
    rawValue !== null && rawValue !== undefined
      ? valueField?.currency
        ? `${valueField.currency} ${rawValue}`
        : String(rawValue)
      : undefined;

  const extractedFields = Object.entries(metadata).map(([key, field]) => ({
    key,
    label: field.label,
    value:
      field.normalizedValue !== null && field.normalizedValue !== undefined
        ? String(field.normalizedValue)
        : field.value === null || field.value === undefined
          ? '—'
          : String(field.value),
    confidence: field.confidence,
    evidence: field.evidence,
  }));

  return {
    jobId: response.jobId,
    originalFileName: response.originalFileName,
    suggestedName: response.recommendedFileName ?? '—',
    documentType: classification.className ?? extraction?.documentType ?? 'Indefinido',
    supplier,
    documentDate,
    value,
    suggestedVersion: extraction?.version ?? 'v1.0',
    confidenceScore: classification.confidence,
    analysisStatus: response.status,
    missingFields: extraction?.missingFields ?? [],
    reviewReasons: extraction?.reviewReasons ?? (classification.reviewReason ? [classification.reviewReason] : []),
    extractedFields,
    classificationEvidence: classification.evidence,
    classificationReason: classification.reason,
    textExtraction: response.textExtraction,
  };
}

export async function analyzePdf(
  file: File,
  options?: AnalyzePdfOptions,
): Promise<{
  metadata: ExtractedMetadata;
  logs: ProcessingLogItem[];
  raw: AnalyzePdfResponse;
  durationMs: number;
  httpStatus: number;
  requestId: string;
}> {
  const requestId = options?.context?.requestId ?? createRequestId();
  const context: WorkflowRequestContext = {
    ...options?.context,
    requestId,
    fileName: options?.context?.fileName ?? file.name,
  };

  const formData = new FormData();
  formData.append('file', file);

  const startedAt = performance.now();
  const response = await authFetch('/api/ai/analyze-pdf', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(buildRequestHeaders(context), { json: false }),
    body: formData,
    signal: options?.signal,
  });
  const durationMs = Math.round(performance.now() - startedAt);

  const payload = (await response.json().catch(() => null)) as
    | AnalyzePdfResponse
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && 'message' in payload && payload.message
        ? payload.message
        : 'Erro ao analisar documento';
    const code =
      payload && 'code' in payload && typeof payload.code === 'string'
        ? payload.code
        : undefined;
    throw new AnalyzePdfRequestError(message, code);
  }

  if (!payload || !('jobId' in payload)) {
    throw new Error('Resposta inválida do servidor');
  }

  const result = payload as AnalyzePdfResponse;

  return {
    metadata: mapToExtractedMetadata(result, result.extraction, result.classification),
    logs: mapApiLogs(result.logs),
    raw: result,
    durationMs,
    httpStatus: response.status,
    requestId,
  };
}
