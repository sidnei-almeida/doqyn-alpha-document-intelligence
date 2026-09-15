import { i18n } from '@/i18n';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';
import type { WorkflowRequestContext } from '../types/workflowLog';
import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { buildRequestHeaders, createRequestId } from '../utils/workflowLogHelpers';
import type { AnalyzePdfResponse } from './analyzePdf';
import { normalizeAnalyzePayloadForConfirm } from './normalizeConfirmPayload';

export type ConfirmUpdateDocumentVersionResponse = {
  documentId: string;
  versionId: string;
  previousVersionId: string;
  versionLabel: string;
  status: 'updated';
  storageStatus: 'stored' | 'pending';
};

export type ConfirmUpdateDocumentVersionOptions = {
  documentId: string;
  manualReviewConfirmed?: boolean;
  namingMode?: 'ai_suggested' | 'original' | 'manual';
  finalFileName?: string;
  selectedFileName?: string;
  useAiNaming?: boolean;
  versionLabel?: string;
  context?: WorkflowRequestContext;
};

export async function confirmUpdateDocumentVersion(
  payload: AnalyzePdfResponse,
  options: ConfirmUpdateDocumentVersionOptions,
): Promise<
  ConfirmUpdateDocumentVersionResponse & {
    durationMs: number;
    httpStatus: number;
    requestId: string;
  }
> {
  const requestId = options.context?.requestId ?? createRequestId();
  const context: WorkflowRequestContext = {
    ...options.context,
    requestId,
    fileName: options.context?.fileName ?? payload.originalFileName,
  };

  const startedAt = performance.now();
  const effectiveNamingMode =
    options.useAiNaming === false ? 'original' : (options.namingMode ?? 'ai_suggested');
  const normalizedPayload = normalizeAnalyzePayloadForConfirm(payload);

  const extraction = normalizedPayload.extraction
    ? {
        ...normalizedPayload.extraction,
        version: options.versionLabel ?? normalizedPayload.extraction.version,
      }
    : normalizedPayload.extraction;

  const response = await authFetch('/api/documents/confirm-update', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(buildRequestHeaders(context)),
    body: JSON.stringify({
      ...normalizedPayload,
      extraction,
      documentId: options.documentId,
      manualReviewConfirmed: options.manualReviewConfirmed ?? false,
      namingMode: effectiveNamingMode,
      aiSuggestedFileName: normalizedPayload.recommendedFileName,
      finalFileName: options.finalFileName,
      selectedFileName: options.selectedFileName,
    }),
  });
  const durationMs = Math.round(performance.now() - startedAt);

  const data = (await response.json().catch(() => null)) as
    | ConfirmUpdateDocumentVersionResponse
    | { message?: string; code?: string; status?: string }
    | null;

  if (!response.ok) {
    const serverMessage = (data && 'message' in data && data.message) || undefined;
    const code = (data && 'code' in data && data.code) || undefined;
    const message = code
      ? getFriendlyAuthErrorMessage(code, serverMessage)
      : (serverMessage ?? i18n.t('documentSend:confirmError.updateFailed'));
    throw new Error(message);
  }

  if (!data || !('documentId' in data)) {
    throw new Error(i18n.t('documentSend:analysisError.respostaInvalidaAtualizar'));
  }

  return {
    ...data,
    durationMs,
    httpStatus: response.status,
    requestId,
  };
}
