import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';

export type DocumentUploadApprovalRecord = {
  id: string;
  status: 'pending';
  submittedBy: {
    userId: string;
    membershipId?: string;
    name: string;
    email: string;
  };
  originalFileName: string;
  classId: string | null;
  className: string | null;
  fileHash: string;
  jobId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function listDocumentUploadApprovals(): Promise<DocumentUploadApprovalRecord[]> {
  const response = await authFetch('/api/documents/upload-approvals', {
    method: 'GET',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | { approvals?: DocumentUploadApprovalRecord[]; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(data?.message ?? 'Não foi possível carregar envios pendentes.');
  }

  return data?.approvals ?? [];
}

export async function approveDocumentUploadApproval(approvalId: string): Promise<{
  documentId: string;
  versionId: string;
  approvalId: string;
}> {
  const response = await authFetch(`/api/documents/upload-approvals/${approvalId}/approve`, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });

  const data = (await response.json().catch(() => null)) as
    | { documentId?: string; versionId?: string; approvalId?: string; message?: string }
    | null;

  if (!response.ok || !data?.documentId || !data.versionId) {
    throw new Error(data?.message ?? 'Não foi possível aprovar o envio.');
  }

  return {
    documentId: data.documentId,
    versionId: data.versionId,
    approvalId: data.approvalId ?? approvalId,
  };
}

export async function rejectDocumentUploadApproval(
  approvalId: string,
  reason: string,
): Promise<void> {
  const response = await authFetch(`/api/documents/upload-approvals/${approvalId}/reject`, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reason }),
  });

  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(data?.message ?? 'Não foi possível rejeitar o envio.');
  }
}
