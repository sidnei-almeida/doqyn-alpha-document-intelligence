import type { WorkflowRequestContext } from '../types/workflowLog';
import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { buildRequestHeaders, createRequestId } from '../utils/workflowLogHelpers';
import type { AnalyzePdfResponse } from './analyzePdf';

export type ConfirmAnalysisResponse = {
  documentId: string;
  versionId: string;
  status: 'saved';
  documentCode: string;
  storageStatus: 'stored' | 'pending';
};

export type ConfirmAnalysisOptions = {
  manualReviewConfirmed?: boolean;
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
  const response = await authFetch('/api/documents/confirm-analysis', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(buildRequestHeaders(context)),
    body: JSON.stringify({
      ...payload,
      manualReviewConfirmed: options?.manualReviewConfirmed ?? false,
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
