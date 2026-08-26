import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import type { CompanyMemberDto } from '@/features/users/api/usersApi';

/**
 * Um pedido esperando decisão, na forma que o servidor devolve.
 *
 * Antes esta lista era montada aqui: uma chamada para membros, outra para aprovações de envio, e
 * uma terceira direto ao auth-service — três origens fundidas à mão, com o tipo de cada item
 * deduzido no navegador. Agora `/api/approval-requests` faz a fusão e devolve uma lista só.
 */
export type PendingApprovalItem = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  tenantId: string;
  tenantName?: string;
  type: 'access_request' | 'invite' | 'registration' | 'document_upload' | 'document_download';
  status: 'pending';
  requestedAt: string;
  requestedAccess?: CompanyMemberDto['requestedAccess'];
  member?: CompanyMemberDto;
  documentUpload?: {
    approvalId: string;
    originalFileName: string;
    classId: string | null;
    className: string | null;
    payload: Record<string, unknown>;
  };
};

type PendingApprovalDto = {
  id: string;
  kind: PendingApprovalItem['type'];
  status: 'pending';
  requestedAt: string;
  requestedBy: { userId?: string; membershipId?: string; name: string; email: string };
  tenantId: string;
  tenantName?: string;
  member?: CompanyMemberDto;
  accessRequest?: {
    consent?: unknown;
    terms?: unknown;
    notificationPreferences?: unknown;
    requestedAccess?: unknown;
  };
  documentUpload?: PendingApprovalItem['documentUpload'];
};

function toPendingApprovalItem(dto: PendingApprovalDto): PendingApprovalItem {
  return {
    id: dto.id,
    membershipId: dto.requestedBy.membershipId ?? dto.id,
    name: dto.requestedBy.name,
    email: dto.requestedBy.email,
    tenantId: dto.tenantId,
    tenantName: dto.tenantName,
    type: dto.kind,
    status: 'pending',
    requestedAt: dto.requestedAt,
    requestedAccess: dto.member?.requestedAccess,
    member: dto.member,
    documentUpload: dto.documentUpload,
  };
}

export async function listPendingApprovals(): Promise<PendingApprovalItem[]> {
  const response = await authFetch('/api/approval-requests', {
    method: 'GET',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar as pendências.');
  }

  const data = (await response.json()) as { items?: PendingApprovalDto[] };
  return (data.items ?? []).map(toPendingApprovalItem);
}

export type ApprovalDecision = 'approved' | 'rejected';

export async function decideApprovalRequest(
  requestId: string,
  decision: ApprovalDecision,
  reason?: string,
): Promise<void> {
  const response = await authFetch(`/api/approval-requests/${encodeURIComponent(requestId)}/decide`, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: { ...withAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Não foi possível registrar a decisão.');
  }
}

export const PENDING_TYPE_LABELS: Record<PendingApprovalItem['type'], string> = {
  access_request: 'Solicitação de acesso',
  invite: 'Convite pendente',
  registration: 'Cadastro aguardando aprovação',
  document_upload: 'Envio de documento',
  document_download: 'Download de documento',
};
