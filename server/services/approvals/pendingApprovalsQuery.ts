import type { MongoApprovalRequest, MongoTenantMember, PlatformRole } from '../../db/types.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { listApprovalRequests } from './approvalRequestService.js';

/**
 * A forma canônica de um pedido na fila, independente de onde ele nasceu.
 *
 * Os quatro tipos vêm de origens diferentes — três são pessoas esperando acesso (espelhadas do
 * auth-service em `tenant_members`) e um é envio de documento (`approval_requests`, no Mongo do
 * app). Quem lê a fila não precisa saber disso.
 */
export type PendingApprovalKind = 'access_request' | 'invite' | 'registration' | 'document_upload';

export type PendingApprovalDto = {
  id: string;
  kind: PendingApprovalKind;
  status: 'pending';
  requestedAt: string;
  requestedBy: {
    userId?: string;
    membershipId?: string;
    name: string;
    email: string;
  };
  tenantId: string;
  tenantName?: string;
  /** Presente nos três tipos de pessoa. */
  member?: MongoTenantMember;
  /** Presente em `document_upload`. */
  documentUpload?: {
    approvalId: string;
    originalFileName: string;
    classId: string | null;
    className: string | null;
    payload: Record<string, unknown>;
  };
};

function memberDisplayName(member: MongoTenantMember): string {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return member.username ?? member.email;
}

/**
 * De onde a pessoa veio, deduzido do que ela trouxe.
 *
 * Mesma regra que rodava no navegador: quem declarou motivo pediu acesso; quem já tem conta no
 * auth veio de convite; o resto é cadastro novo. É dedução, não um campo — o dia em que o pedido
 * de acesso virar `MongoApprovalRequest` também, isto deixa de existir.
 */
function inferMemberKind(member: MongoTenantMember): PendingApprovalKind {
  if (member.requestedAccess?.source === 'public_form' || member.requestedAccess?.reason) {
    return 'access_request';
  }
  if (member.requestedAccess?.source === 'admin_invite' || member.invitedBy) return 'invite';
  return 'registration';
}

function mapMember(member: MongoTenantMember): PendingApprovalDto {
  return {
    id: member.memberId,
    kind: inferMemberKind(member),
    status: 'pending',
    requestedAt: (member.requestedAccess?.requestedAt ?? member.createdAt ?? new Date()).toString(),
    requestedBy: {
      userId: member.authUserId,
      membershipId: member.memberId,
      name: memberDisplayName(member),
      email: member.email,
    },
    tenantId: member.tenantId,
    tenantName: member.requestedAccess?.tenantDisplayName,
    member,
  };
}

function mapApprovalRequest(request: MongoApprovalRequest): PendingApprovalDto {
  return {
    id: request._id,
    kind: request.kind,
    status: 'pending',
    requestedAt: request.createdAt.toISOString(),
    requestedBy: {
      userId: request.requestedBy.userId,
      membershipId: request.requestedBy.membershipId,
      name: request.requestedBy.name,
      email: request.requestedBy.email,
    },
    tenantId: request.tenantId,
    documentUpload: {
      approvalId: request._id,
      originalFileName: request.subject.documentName ?? '—',
      classId: request.subject.categoryId ?? null,
      className: request.subject.categoryName ?? null,
      payload: request.payload,
    },
  };
}

export type ListPendingApprovalsInput = {
  tenantId: string;
  userId: string;
  platformRoles: PlatformRole[];
  limit?: number;
  cursor?: string;
};

/**
 * A fila que a tela de Auditoria mostra.
 *
 * Quem não administra o tenant não tem fila: `individual_admin` cuida da própria conta e não há
 * outra pessoa para aprovar nada, e `user` não decide. Devolver lista vazia é a resposta certa —
 * não é erro de permissão, é ausência de trabalho.
 */
export async function listPendingApprovalsForTenant(
  input: ListPendingApprovalsInput,
): Promise<{ items: PendingApprovalDto[]; nextCursor: string | null }> {
  if (!input.platformRoles.includes('company_admin')) {
    return { items: [], nextCursor: null };
  }

  const [members, requests] = await Promise.all([
    listOperationalTenantMembers(input.tenantId),
    listApprovalRequests({
      tenantId: input.tenantId,
      decidableByUserId: input.userId,
      status: 'pending',
      limit: input.limit,
      cursor: input.cursor,
    }),
  ]);

  const items = [
    ...members.filter((member) => member.status === 'pending').map(mapMember),
    ...requests.items.map(mapApprovalRequest),
  ].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  return { items, nextCursor: requests.nextCursor };
}
