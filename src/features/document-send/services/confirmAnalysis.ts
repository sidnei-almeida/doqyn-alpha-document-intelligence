import type { WorkflowRequestContext } from '../types/workflowLog';
import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { buildRequestHeaders, createRequestId } from '../utils/workflowLogHelpers';
import type { AnalyzePdfResponse } from './analyzePdf';
import { normalizeAnalyzePayloadForConfirm } from './normalizeConfirmPayload';

export type ConfirmAnalysisResponse = {
  documentId: string;
  versionId: string;
  status: 'saved';
  documentCode: string;
  storageStatus: 'stored' | 'pending';
};

export type SubmitUploadApprovalResponse = {
  approvalId: string;
  status: 'pending';
};

export type ConfirmAnalysisOptions = {
  manualReviewConfirmed?: boolean;
  /**
   * Categoria escolhida à mão na revisão. É o que resgata o documento que a IA não conseguiu
   * classificar — sem ela, a confirmação é recusada por falta de classe.
   */
  manualClassId?: string;
  /** Campos corrigidos à mão na revisão, por chave. Entram com origem manual na auditoria. */
  metadataOverrides?: Record<string, string | number | null>;
  namingMode?: 'ai_suggested' | 'original' | 'manual';
  finalFileName?: string;
  selectedFileName?: string;
  useAiNaming?: boolean;
  context?: WorkflowRequestContext;
};

export async function confirmAnalysis(
  payload: AnalyzePdfResponse,
  options?: ConfirmAnalysisOptions,
): Promise<ConfirmAnalysisResponse & { durationMs: number; httpStatus: number; requestId: string }> {
  const requestId = options?.context?.requestId ?? createRequestId();
  const context: WorkflowRequestContext = {
    ...options?.context,
    requestId,
    fileName: options?.context?.fileName ?? payload.originalFileName,
  };

  const startedAt = performance.now();
  const effectiveNamingMode =
    options?.useAiNaming === false ? 'original' : (options?.namingMode ?? 'ai_suggested');
  const normalizedPayload = normalizeAnalyzePayloadForConfirm(payload);

  const response = await authFetch('/api/documents/confirm-analysis', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(buildRequestHeaders(context)),
    body: JSON.stringify({
      ...normalizedPayload,
      manualReviewConfirmed: options?.manualReviewConfirmed ?? false,
      manualClassId: options?.manualClassId,
      metadataOverrides: options?.metadataOverrides,
      namingMode: effectiveNamingMode,
      aiSuggestedFileName: normalizedPayload.recommendedFileName,
      finalFileName: options?.finalFileName,
      selectedFileName: options?.selectedFileName,
    }),
  });
  const durationMs = Math.round(performance.now() - startedAt);

  const data = (await response.json().catch(() => null)) as
    | ConfirmAnalysisResponse
    | { message?: string; code?: string; status?: string }
    | null;

  if (!response.ok) {
    const message =
      data && 'message' in data && data.message
        ? data.message
        : 'Não foi possível salvar o documento.';
    throw new Error(message);
  }

  if (!data || !('documentId' in data)) {
    throw new Error('Resposta inválida ao salvar documento.');
  }

  return {
    ...data,
    durationMs,
    httpStatus: response.status,
    requestId,
  };
}

export async function submitUploadForApproval(
  payload: AnalyzePdfResponse,
  options?: ConfirmAnalysisOptions,
): Promise<SubmitUploadApprovalResponse & { durationMs: number; httpStatus: number; requestId: string }> {
  const requestId = options?.context?.requestId ?? createRequestId();
  const context: WorkflowRequestContext = {
    ...options?.context,
    requestId,
    fileName: options?.context?.fileName ?? payload.originalFileName,
  };

  const startedAt = performance.now();
  const effectiveNamingMode =
    options?.useAiNaming === false ? 'original' : (options?.namingMode ?? 'ai_suggested');
  const normalizedPayload = normalizeAnalyzePayloadForConfirm(payload);

  const response = await authFetch('/api/documents/submit-upload-approval', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(buildRequestHeaders(context)),
    body: JSON.stringify({
      ...normalizedPayload,
      manualReviewConfirmed: options?.manualReviewConfirmed ?? false,
      manualClassId: options?.manualClassId,
      metadataOverrides: options?.metadataOverrides,
      namingMode: effectiveNamingMode,
      aiSuggestedFileName: normalizedPayload.recommendedFileName,
      finalFileName: options?.finalFileName,
      selectedFileName: options?.selectedFileName,
    }),
  });
  const durationMs = Math.round(performance.now() - startedAt);

  const data = (await response.json().catch(() => null)) as
    | SubmitUploadApprovalResponse
    | { message?: string; code?: string }
    | null;

  if (!response.ok) {
    const message =
      data && 'message' in data && data.message
        ? data.message
        : 'Não foi possível enviar o documento para aprovação.';
    throw new Error(message);
  }

  if (!data || !('approvalId' in data)) {
    throw new Error('Resposta inválida ao enviar documento para aprovação.');
  }

  return {
    ...data,
    durationMs,
    httpStatus: response.status,
    requestId,
  };
}
