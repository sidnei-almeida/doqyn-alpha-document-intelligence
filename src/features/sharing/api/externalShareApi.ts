import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type ExternalDocumentShareEntry = {
  shareId: string;
  recipientEmail: string;
  recipientPhoneMasked?: string | null;
  recipientName?: string | null;
  recipientOrganizationName?: string | null;
  permissions: {
    canView: boolean;
    canDownload: boolean;
  };
  status: 'pending' | 'active' | 'revoked' | 'expired';
  expiresAt?: string | null;
  inviteExpiresAt: string;
  acceptedAt?: string | null;
  lastAccessAt?: string | null;
  createdAt: string;
  sharedByUserId: string;
  sharedByNameSnapshot?: string | null;
  message?: string | null;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function fetchDocumentExternalShares(documentId: string): Promise<{
  documentId: string;
  shares: ExternalDocumentShareEntry[];
}> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/external-shares`);
  return parseJson(response);
}

export async function createDocumentExternalShare(
  documentId: string,
  input: {
    recipientEmail: string;
    recipientPhone?: string;
    recipientName?: string;
    recipientOrganizationName?: string;
    permissions?: { canView?: boolean; canDownload?: boolean };
    expiresAt?: string;
    message?: string;
  },
): Promise<{
  shareId: string;
  inviteToken: string;
  invitePath: string;
  inviteUrl: string;
  updated: boolean;
}> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/external-shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function revokeDocumentExternalShare(
  documentId: string,
  shareId: string,
): Promise<void> {
  const doc = encodeURIComponent(documentId);
  const share = encodeURIComponent(shareId);
  const response = await authFetch(`/api/documents/${doc}/external-shares/${share}`, {
    method: 'DELETE',
  });
  await parseJson(response);
}

export async function regenerateDocumentExternalShare(
  documentId: string,
  shareId: string,
): Promise<{
  shareId: string;
  inviteToken: string;
  invitePath: string;
  inviteUrl: string;
}> {
  const doc = encodeURIComponent(documentId);
  const share = encodeURIComponent(shareId);
  const response = await authFetch(
    `/api/documents/${doc}/external-shares/${share}/regenerate-invite`,
    { method: 'POST' },
  );
  return parseJson(response);
}

export type ExternalSharePortalPayload = {
  shareId: string;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  permissions: { canView: boolean; canDownload: boolean };
  expiresAt?: string | null;
  inviteExpiresAt: string;
  sharedAt: string;
  sharedByName: string;
  ownerTenantName: string;
  recipientEmail: string;
  recipientName?: string | null;
  recipientOrganizationName?: string | null;
  message?: string | null;
  document: {
    documentId: string;
    displayName: string;
    categoryName: string;
    versionLabel?: string | null;
    versionId: string;
    mimeType?: string | null;
  };
};

export async function fetchExternalSharePortal(token: string): Promise<ExternalSharePortalPayload> {
  const encoded = encodeURIComponent(token);
  const response = await fetch(`/api/external-shares/${encoded}`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<ExternalSharePortalPayload>;
}

export async function acceptExternalShareInvite(token: string): Promise<{
  shareId: string;
  status: 'active';
  alreadyAccepted: boolean;
}> {
  const encoded = encodeURIComponent(token);
  const response = await fetch(`/api/external-shares/${encoded}/accept`, { method: 'POST' });
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<{
    shareId: string;
    status: 'active';
    alreadyAccepted: boolean;
  }>;
}

export async function fetchExternalSharePreviewManifest(token: string) {
  const encoded = encodeURIComponent(token);
  const response = await fetch(`/api/external-shares/${encoded}/preview/manifest`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json();
}

export async function fetchExternalShareAssetBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}

export async function downloadExternalShareDocument(token: string): Promise<Blob> {
  const encoded = encodeURIComponent(token);
  const response = await fetch(`/api/external-shares/${encoded}/download`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}
