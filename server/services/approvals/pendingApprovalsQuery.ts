import type { MongoApprovalRequest, PlatformRole } from '../../db/types.js';
import {
  fetchTenantAccessRequests,
  type AuthAccessRequestSnapshot,
} from '../../integrations/doqynAuthInternalClient.js';
import { usesDoqynAuth } from '../../auth/authConfig.js';
import { logger } from '../../utils/logger.js';
import type { GovernanceMemberRecord } from '../governanceMembersService.js';
import type { MongoDocumentUploadApproval } from '../../db/types.js';
import { listApprovalRequests } from './approvalRequestService.js';

/**
 * A forma canônica de um pedido na fila, independente de onde ele nasceu.
 *
 * Os tipos vêm de origens diferentes — três são pessoas esperando acesso (espelhadas do
 * auth-service em `tenant_members`) e os demais são ações sobre documento (`approval_requests`, no
 * Mongo do app). Quem lê a fila não precisa saber disso.
 */
export type PendingApprovalKind =
  | 'access_request'
  | 'invite'
  | 'registration'
  | 'document_upload'
  | 'document_download'
  | 'document_share';

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
  /**
   * Presente nos três tipos de pessoa, na mesma forma que `/api/company-members` serve — é o que
   * o cartão de revisão já sabe ler.
   */
  member?: GovernanceMemberRecord;
  /**
   * O que a pessoa declarou ao pedir acesso — cargo, setor, motivo, consentimento, termos.
   *
   * Vem do auth-service, que é o dono desse dado. O espelho em `tenant_members` guarda o
   * suficiente para operar, não o suficiente para decidir.
   */
  accessRequest?: AuthAccessRequestSnapshot;
  /** O que se pede, sobre o quê. Presente em todo pedido de documento. */
  subject?: {
    documentId?: string;
    documentName?: string;
    categoryName?: string;
    /** Em `document_share`, o destinatário — o segundo lado da decisão. */
    memberId?: string;
    memberName?: string;
  };
  /**
   * O que a aprovação vai conceder, quando o pedido carrega um efeito a executar.
   *
   * Aprovar um `document_share` aplica as permissões pedidas tal como vieram. Sem isto na ficha, o
   * administrador libera o download de um documento com portão sem ver que era isso que estava
   * decidindo — e controlar exatamente esse direito é para o que o estado `require` existe.
   */
  grants?: {
    canView: boolean;
    canDownload: boolean;
  };
  /** Presente só em `document_upload` — é o cartão de revisão do arquivo enviado. */
  documentUpload?: {
    approvalId: string;
    originalFileName: string;
    classId: string | null;
    className: string | null;
    payload: Record<string, unknown>;
  };
};

function memberDisplayName(member: GovernanceMemberRecord): string {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return member.name || member.email;
}

/**
 * De onde a pessoa veio, deduzido do que ela trouxe.
 *
 * Mesma regra que rodava no navegador: quem declarou motivo pediu acesso; quem já tem conta no
 * auth veio de convite; o resto é cadastro novo. É dedução, não um campo — o dia em que o pedido
 * de acesso virar `MongoApprovalRequest` também, isto deixa de existir.
 */
function inferMemberKind(member: GovernanceMemberRecord): PendingApprovalKind {
  if (member.requestedAccess?.source === 'public_form' || member.requestedAccess?.reason) {
    return 'access_request';
  }
  if (member.requestedAccess?.source === 'admin_invite') return 'invite';
  return 'registration';
}

function mapMember(member: GovernanceMemberRecord): PendingApprovalDto {
  return {
    id: member.id,
    kind: inferMemberKind(member),
    status: 'pending',
    requestedAt: member.requestedAccess?.requestedAt ?? member.createdAt,
    requestedBy: {
      userId: member.userId,
      membershipId: member.id,
      name: memberDisplayName(member),
      email: member.email,
    },
    tenantId: member.tenantId,
    tenantName: member.requestedAccess?.tenantDisplayName,
    member,
  };
}

/**
 * Envio pendente no formato antigo.
 *
 * O fluxo de upload ainda grava em `document_upload_approvals`, com serviço próprio para aprovar
 * e publicar o documento. Enquanto ele não migrar para `MongoApprovalRequest`, a fila lê as duas
 * coleções — parar de ler a antiga faria pendências reais sumirem da tela.
 */
function mapLegacyUploadApproval(approval: MongoDocumentUploadApproval): PendingApprovalDto {
  return {
    id: approval._id,
    kind: 'document_upload',
    status: 'pending',
    requestedAt: approval.createdAt.toISOString(),
    requestedBy: {
      userId: approval.submittedBy.userId,
      membershipId: approval.submittedBy.membershipId,
      name: approval.submittedBy.name,
      email: approval.submittedBy.email,
    },
    tenantId: approval.tenantId,
    documentUpload: {
      approvalId: approval._id,
      originalFileName: approval.originalFileName,
      classId: approval.classId,
      className: approval.className,
      payload: approval.payload,
    },
  };
}

/**
 * As permissões que a aprovação vai conceder, lidas do `payload`.
 *
 * Só `document_share` tem efeito com permissão embutida. `canShare` não entra porque o serviço o
 * força a `false` — o que a ficha precisa mostrar é o que varia.
 */
function readSharePermissions(request: MongoApprovalRequest): PendingApprovalDto['grants'] {
  if (request.kind !== 'document_share') return undefined;

  const permissions = (
    request.payload as { permissions?: { canView?: unknown; canDownload?: unknown } }
  ).permissions;
  return {
    canView: permissions?.canView !== false,
    canDownload: permissions?.canDownload === true,
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
    // `documentUpload` é o formato que o cartão de revisão já lê, e só o envio o preenche. Um
    // pedido de download não tem arquivo a revisar — tem documento a liberar, que vai em `subject`.
    documentUpload:
      request.kind === 'document_upload'
        ? {
            approvalId: request._id,
            originalFileName: request.subject.documentName ?? '—',
            classId: request.subject.categoryId ?? null,
            className: request.subject.categoryName ?? null,
            payload: request.payload,
          }
        : undefined,
    subject: {
      documentId: request.subject.documentId,
      documentName: request.subject.documentName,
      categoryName: request.subject.categoryName,
      memberId: request.subject.memberId,
      memberName: request.subject.memberName,
    },
    grants: readSharePermissions(request),
  };
}

export type ListPendingApprovalsInput = {
  tenantId: string;
  userId: string;
  platformRoles: PlatformRole[];
  /**
   * Membros do tenant, já serializados pelo caminho de sempre.
   *
   * Entram por parâmetro em vez de serem buscados aqui porque `listGovernanceMembers` precisa do
   * `req` e do ator, e arrastar a requisição HTTP para dentro do serviço só para reaproveitar uma
   * serialização não vale o acoplamento.
   */
  members: GovernanceMemberRecord[];
  /** Envios pendentes no formato antigo, enquanto o fluxo de upload não migra. */
  legacyUploadApprovals: MongoDocumentUploadApproval[];
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
/**
 * O detalhe declarado no pedido de acesso, quando houver.
 *
 * Falha de rede aqui não pode derrubar a fila: sem o detalhe a pendência ainda aparece, com nome,
 * e-mail e data — só o cartão de revisão fica mais pobre. Perder a fila inteira por causa do
 * enriquecimento seria trocar um problema pequeno por um grande.
 */
async function loadAccessRequestDetails(tenantId: string): Promise<AuthAccessRequestSnapshot[]> {
  if (!usesDoqynAuth()) return [];
  try {
    return await fetchTenantAccessRequests(tenantId, 'pending');
  } catch (error) {
    logger.warn('falha ao carregar detalhes de solicitações de acesso', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function listPendingApprovalsForTenant(
  input: ListPendingApprovalsInput,
): Promise<{ items: PendingApprovalDto[]; nextCursor: string | null }> {
  if (!input.platformRoles.includes('company_admin')) {
    return { items: [], nextCursor: null };
  }

  const [requests, accessRequests] = await Promise.all([
    listApprovalRequests({
      tenantId: input.tenantId,
      decidableByUserId: input.userId,
      status: 'pending',
      limit: input.limit,
      cursor: input.cursor,
    }),
    loadAccessRequestDetails(input.tenantId),
  ]);
  const members = input.members;

  const detailByMembership = new Map(
    accessRequests
      .filter((request) => request.membershipId)
      .map((request) => [request.membershipId as string, request]),
  );

  /**
   * Os membros não paginam.
   *
   * Só os pedidos têm cursor, e a lista sai ordenada do mais recente. Enquanto a fila couber numa
   * página — que é o caso de qualquer tenant real hoje — a mistura não aparece. Quando um tenant
   * passar disso, membros e pedidos precisam paginar pela mesma chave, e o caminho é o inverso:
   * pedido de acesso vira `MongoApprovalRequest` também, e some a fusão.
   */
  const items = [
    ...members
      .filter((member) => member.status === 'pending')
      .map((member) => {
        const item = mapMember(member);
        const detail = detailByMembership.get(member.id);
        return detail
          ? { ...item, accessRequest: detail, tenantName: detail.tenantName ?? item.tenantName }
          : item;
      }),
    ...requests.items.map(mapApprovalRequest),
    ...input.legacyUploadApprovals.map(mapLegacyUploadApproval),
  ].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  return { items, nextCursor: requests.nextCursor };
}
