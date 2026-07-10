import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';
import type { DocumentSignatureSummary } from '@/types/document-library';

export type SignaturePortalPayload = {
  signatureRequestId: string;
  documentId: string;
  versionId: string;
  versionLabel?: string | null;
  isVersionStale?: boolean;
  documentName: string;
  issuerName: string;
  signer: {
    signerId: string;
    signerType: string;
    name: string;
    emailMasked: string;
    phoneMasked?: string | null;
    organizationName?: string | null;
    status: string;
  };
  permissions: {
    canView: boolean;
    canSign: boolean;
    canDownloadAfterSign: boolean;
  };
  expiresAt: string | null;
  message: string | null;
  consentText: string;
  status: string;
};

export type SignatureSignResult = {
  signatureId: string;
  verificationCode: string;
  signedAt: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function fetchSignaturePortal(token: string): Promise<SignaturePortalPayload> {
  const response = await fetch(`/api/sign/${encodeURIComponent(token)}`);
  return parseJson(response);
}

export async function fetchSignaturePreviewManifest(token: string) {
  const response = await fetch(`/api/sign/${encodeURIComponent(token)}/preview/manifest`);
  return parseJson(response);
}

export async function fetchSignaturePreviewAssetBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}

export async function signDocumentViaPortal(
  token: string,
  consentAccepted: boolean,
): Promise<SignatureSignResult> {
  const response = await fetch(`/api/sign/${encodeURIComponent(token)}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consentAccepted, action: 'sign' }),
  });
  return parseJson(response);
}

export async function downloadSignedPdfViaToken(token: string): Promise<Blob> {
  const response = await fetch(`/api/sign/${encodeURIComponent(token)}/signed-pdf`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}

export async function createDocumentSignatureRequest(
  documentId: string,
  input: {
    signerType?: 'internal_user' | 'external_guest';
    signerUserId?: string;
    signerName?: string;
    signerEmail?: string;
    signerPhone?: string;
    signerOrganizationName?: string;
    message?: string;
    expiresAt?: string;
    permissions?: { canDownloadAfterSign?: boolean };
  },
) {
  const response = await authFetch(`/api/documents/${encodeURIComponent(documentId)}/signature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json();
}

export async function fetchPublicSignatureVerification(verificationCode: string) {
  const response = await fetch(`/api/verify/signature/${encodeURIComponent(verificationCode)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Assinatura não encontrada.');
  }
  return response.json();
}

export type DocumentSignatureRequestEntry = {
  signatureRequestId: string;
  documentId: string;
  versionId: string;
  status: string;
  requestedByName: string;
  permissions: {
    canView: boolean;
    canSign: boolean;
    canDownloadAfterSign: boolean;
  };
  signers: Array<{
    signerId: string;
    name: string;
    emailMasked: string;
    phoneMasked?: string | null;
    organizationName?: string | null;
    status: string;
    signedAt?: string | null;
  }>;
  message: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  signature: {
    signatureId: string;
    verificationCode: string;
    signedAt: string;
    hasSignedPdf: boolean;
    hasEvidence: boolean;
  } | null;
};

export async function fetchDocumentSignatureRequests(documentId: string): Promise<{
  items: DocumentSignatureRequestEntry[];
}> {
  const response = await authFetch(
    `/api/documents/${encodeURIComponent(documentId)}/signature-requests`,
  );
  return parseJson(response);
}

export async function cancelDocumentSignatureRequest(
  documentId: string,
  signatureRequestId: string,
): Promise<{
  signatureRequestId: string;
  documentId: string;
  status: 'cancelled';
}> {
  const response = await authFetch(
    `/api/documents/${encodeURIComponent(documentId)}/signature-requests/${encodeURIComponent(signatureRequestId)}/cancel`,
    { method: 'POST' },
  );
  return parseJson(response);
}

export async function downloadSignatureRequestSignedPdf(signatureRequestId: string): Promise<Blob> {
  const response = await authFetch(
    `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/signed-pdf`,
  );
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}

export async function downloadSignatureRequestEvidence(signatureRequestId: string): Promise<Blob> {
  const response = await authFetch(
    `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/evidence`,
  );
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}

export type { DocumentSignatureSummary };

export type AssignedSignatureRequestItem = {
  signatureRequestId: string;
  documentId: string;
  documentName: string;
  versionId: string;
  versionLabel?: string | null;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string | null;
  status: string;
  signerStatus: string;
  canSign: boolean;
};

export type InternalSignatureSigningPayload = SignaturePortalPayload & {
  signerType: 'internal_user';
};

export async function fetchAssignedSignatureRequests(): Promise<{
  items: AssignedSignatureRequestItem[];
}> {
  const response = await authFetch('/api/signature-requests/assigned-to-me');
  return parseJson(response);
}

export async function fetchInternalSignatureSigningPayload(
  signatureRequestId: string,
): Promise<InternalSignatureSigningPayload> {
  const response = await authFetch(
    `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/signing-payload`,
  );
  return parseJson(response);
}

export async function fetchInternalSignaturePreviewManifest(signatureRequestId: string) {
  const response = await authFetch(
    `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/preview/manifest`,
  );
  return parseJson(response);
}

export async function fetchInternalSignaturePreviewAssetBlob(url: string): Promise<Blob> {
  const response = await authFetch(url);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}

export async function signDocumentViaRequest(
  signatureRequestId: string,
  consentAccepted: boolean,
): Promise<SignatureSignResult> {
  const response = await authFetch(
    `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentAccepted }),
    },
  );
  return parseJson(response);
}
