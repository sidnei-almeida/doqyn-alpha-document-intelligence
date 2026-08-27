import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type InboundShareItem = {
  grantId: string;
  documentId: string;
  documentName: string;
  sharedByName: string;
  originTenantName: string;
  permissions: { canView: boolean; canDownload: boolean; canShare: boolean };
  message?: string | null;
  expiresAt?: string | null;
  receivedAt: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function fetchInboundShares(): Promise<{
  items: InboundShareItem[];
  total: number;
}> {
  return parseJson(await authFetch('/api/inbound-shares'));
}

export async function decideInboundShare(
  grantId: string,
  decision: 'accept' | 'decline',
): Promise<{ item: InboundShareItem }> {
  const response = await authFetch(`/api/inbound-shares/${encodeURIComponent(grantId)}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  return parseJson(response);
}
