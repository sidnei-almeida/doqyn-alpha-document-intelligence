import type { WorkflowRequestContext } from '../types/workflowLog';
import type { WorkflowErrorApiResponse, WorkflowErrorDisplay } from '../types/workflowError';
import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { formatDate, formatTime } from '@/lib/formatLocale';
import { buildRequestHeaders, createRequestId } from '../utils/workflowLogHelpers';
import { parseWorkflowErrorPayload } from '../utils/workflowErrors';
import { UPLOAD_ANALYZE_TIMEOUT_MS } from '@/features/upload/queue/uploadQueueAnalysis';
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

export type AnalyzePdfEnqueueResponse = {
  jobId: string;
  status: 'queued';
  pollUrl: string;
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

export type VersionUpdateExtraction = MetadataExtractionResult & {
  seemsSameDocument: boolean;
  sameDocumentConfidence: number;
  sameDocumentEvidence: string[];
  mainChanges: string[];
  changedFields: string[];
  riskWarnings: string[];
};

export type AnalyzePdfUpdateResponse = AnalyzePdfResponse & {
  updateMode: true;
  documentId: string;
  currentVersionLabel: string;
  expectedNextVersionLabel: string;
  previousVersionContextIncluded: boolean;
  extraction: VersionUpdateExtraction | null;
};

export type AnalysisJobResult = AnalyzePdfResponse | AnalyzePdfUpdateResponse;

type AnalysisJobPollResponse = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'requires_review' | 'ai_unavailable' | 'failed';
  progress?: number;
  pollUrl: string;
  result?: AnalysisJobResult;
  errorCode?: string;
  errorMessage?: string;
};

export type AnalyzePdfOptions = {
  signal?: AbortSignal;
  context?: WorkflowRequestContext;
  /** Quando informado, usa o endpoint de análise de atualização de versão. */
  documentId?: string;
};

type StagingUploadUrlResponse = {
  jobId: string;
  stagingKey: string;
  uploadUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
  method: 'PUT';
  requiredHeaders: {
    'Content-Type': string;
  };
};

function isPresignedUploadEnabled(): boolean {
  return import.meta.env.VITE_PRESIGNED_UPLOAD_ENABLED === 'true';
}

function resolveClientMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/pdf';
}

async function requestStagingUploadUrl(
  file: File,
  signal?: AbortSignal,
): Promise<StagingUploadUrlResponse> {
  const response = await authFetch('/api/documents/upload-url', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders({}, { json: true }),
    body: JSON.stringify({
      fileName: file.name,
      mimeType: resolveClientMimeType(file),
      sizeBytes: file.size,
    }),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as StagingUploadUrlResponse | null;
  if (!response.ok || !payload?.uploadUrl || !payload.jobId) {
    const workflowError = parseWorkflowErrorPayload(
      payload as WorkflowErrorApiResponse | null,
      'Erro ao preparar upload do documento',
    );
    throw new AnalyzePdfRequestError(workflowError);
  }

  return payload;
}

async function putFileToStagingUploadUrl(
  file: File,
  issued: StagingUploadUrlResponse,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(issued.uploadUrl, {
    method: issued.method,
    headers: issued.requiredHeaders,
    body: file,
    signal,
  });

  if (!response.ok) {
    throw new AnalyzePdfRequestError(
      parseWorkflowErrorPayload(
        {
          error: {
            code: 'STAGING_UPLOAD_FAILED',
            category: 'storage',
            title: 'Falha no upload para storage',
            message: 'Falha ao enviar o documento para o storage. Tente novamente.',
          },
        },
        'Falha ao enviar o documento para o storage.',
      ),
    );
  }
}

export class AnalyzePdfRequestError extends Error {
  readonly code?: string;
  readonly workflowError: WorkflowErrorDisplay;

  constructor(workflowError: WorkflowErrorDisplay) {
    super(workflowError.message);
    this.name = 'AnalyzePdfRequestError';
    this.code = workflowError.code;
    this.workflowError = workflowError;
  }
}

function formatNow(): string {
  const now = new Date();
  return `${formatDate(now)} ${formatTime(now, { hour: '2-digit', minute: '2-digit' })}`;
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


function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isTerminalAnalysisStatus(
  status: AnalysisJobPollResponse['status'],
): status is AnalyzePdfResponse['status'] {
  return (
    status === 'completed' ||
    status === 'requires_review' ||
    status === 'ai_unavailable' ||
    status === 'failed'
  );
}

async function pollAnalysisJobResult(
  jobId: string,
  options?: Pick<AnalyzePdfOptions, 'signal'>,
): Promise<AnalysisJobResult> {
  const timeoutMs = UPLOAD_ANALYZE_TIMEOUT_MS;
  const startedAt = performance.now();
  const pollIntervalMs = 2_000;

  while (true) {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const response = await authFetch(`/api/ai/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      credentials: getFetchCredentials(),
      headers: withAuthHeaders({}, { json: true }),
      signal: options?.signal,
    });

    const payload = (await response.json().catch(() => null)) as AnalysisJobPollResponse | null;

    if (!response.ok || !payload) {
      const workflowError = parseWorkflowErrorPayload(
        payload as WorkflowErrorApiResponse | null,
        'Erro ao consultar análise',
      );
      throw new AnalyzePdfRequestError(workflowError);
    }

    if (payload.status === 'failed') {
      const workflowError = parseWorkflowErrorPayload(
        {
          error: {
            code: payload.errorCode ?? 'ANALYSIS_FAILED',
            category: 'ai',
            title: 'Falha na análise',
            message: payload.errorMessage ?? 'Falha na análise do documento.',
          },
        },
        'Falha na análise do documento.',
      );
      throw new AnalyzePdfRequestError(workflowError);
    }

    if (isTerminalAnalysisStatus(payload.status) && payload.result) {
      return payload.result;
    }

    if (isTerminalAnalysisStatus(payload.status) && !payload.result) {
      throw new AnalyzePdfRequestError(
        parseWorkflowErrorPayload(
          {
            error: {
              code: 'ANALYSIS_RESULT_MISSING',
              category: 'ai',
              title: 'Resultado da análise indisponível',
              message: 'Análise concluída sem resultado disponível. Tente novamente.',
            },
          },
          'Análise concluída sem resultado disponível.',
        ),
      );
    }

    if (performance.now() - startedAt >= timeoutMs) {
      throw new Error('Tempo limite aguardando a conclusão da análise.');
    }

    await sleep(pollIntervalMs, options?.signal);
  }
}

export async function analyzePdf(
  file: File,
  options?: AnalyzePdfOptions,
): Promise<{
  metadata: ExtractedMetadata;
  logs: ProcessingLogItem[];
  raw: AnalysisJobResult;
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

  const endpoint = options?.documentId?.trim()
    ? '/api/ai/analyze-pdf-update'
    : '/api/ai/analyze-pdf';

  const startedAt = performance.now();

  if (isPresignedUploadEnabled()) {
    const issued = await requestStagingUploadUrl(file, options?.signal);
    await putFileToStagingUploadUrl(file, issued, options?.signal);

    const response = await authFetch(endpoint, {
      method: 'POST',
      credentials: getFetchCredentials(),
      headers: withAuthHeaders(buildRequestHeaders(context), { json: true }),
      body: JSON.stringify({
        jobId: issued.jobId,
        originalFileName: file.name,
        mimeType: resolveClientMimeType(file),
        sizeBytes: file.size,
        ...(options?.documentId?.trim() ? { documentId: options.documentId.trim() } : {}),
      }),
      signal: options?.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | AnalyzePdfResponse
      | AnalyzePdfEnqueueResponse
      | WorkflowErrorApiResponse
      | null;

    if (response.status === 202) {
      if (!payload || !('jobId' in payload) || payload.status !== 'queued') {
        throw new Error('Resposta inválida do servidor (fila assíncrona)');
      }

      const queued = payload as AnalyzePdfEnqueueResponse;
      const polled = await pollAnalysisJobResult(queued.jobId, options);
      const totalDurationMs = Math.round(performance.now() - startedAt);

      return {
        metadata: mapToExtractedMetadata(polled, polled.extraction, polled.classification),
        logs: mapApiLogs(polled.logs),
        raw: polled,
        durationMs: totalDurationMs,
        httpStatus: 200,
        requestId,
      };
    }

    if (!response.ok) {
      const errorPayload: WorkflowErrorApiResponse | null =
        payload && 'error' in payload ? payload : payload && 'code' in payload ? payload : null;
      const workflowError = parseWorkflowErrorPayload(errorPayload, 'Erro ao analisar documento');
      workflowError.requestId = workflowError.requestId ?? requestId;
      workflowError.endpoint = endpoint;
      throw new AnalyzePdfRequestError(workflowError);
    }

    if (!payload || !('jobId' in payload)) {
      throw new Error('Resposta inválida do servidor');
    }

    const result = payload as AnalyzePdfResponse;
    const durationMs = Math.round(performance.now() - startedAt);

    return {
      metadata: mapToExtractedMetadata(result, result.extraction, result.classification),
      logs: mapApiLogs(result.logs),
      raw: result,
      durationMs,
      httpStatus: response.status,
      requestId,
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  if (options?.documentId?.trim()) {
    formData.append('documentId', options.documentId.trim());
  }

  const response = await authFetch(endpoint, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(buildRequestHeaders(context), { json: false }),
    body: formData,
    signal: options?.signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | AnalyzePdfResponse
    | AnalyzePdfEnqueueResponse
    | WorkflowErrorApiResponse
    | null;
  const durationMs = Math.round(performance.now() - startedAt);

  if (response.status === 202) {
    if (!payload || !('jobId' in payload) || payload.status !== 'queued') {
      throw new Error('Resposta inválida do servidor (fila assíncrona)');
    }

    const queued = payload as AnalyzePdfEnqueueResponse;
    const polled = await pollAnalysisJobResult(queued.jobId, options);
    const totalDurationMs = Math.round(performance.now() - startedAt);

    return {
      metadata: mapToExtractedMetadata(polled, polled.extraction, polled.classification),
      logs: mapApiLogs(polled.logs),
      raw: polled,
      durationMs: totalDurationMs,
      httpStatus: 200,
      requestId,
    };
  }

  if (!response.ok) {
    const errorPayload: WorkflowErrorApiResponse | null =
      payload && 'error' in payload ? payload : payload && 'code' in payload ? payload : null;
    const workflowError = parseWorkflowErrorPayload(errorPayload, 'Erro ao analisar documento');
    workflowError.requestId = workflowError.requestId ?? requestId;
    workflowError.endpoint = endpoint;
    throw new AnalyzePdfRequestError(workflowError);
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
