import type { MongoApprovalRequest, PlatformRole } from '../../db/types.js';
import type { MongoDocumentUploadApproval } from '../../db/types.js';
import { listApprovalRequests } from './approvalRequestService.js';

/**
 * A forma canônica de um pedido na fila, independente de onde ele nasceu.
 *
 * Toda decisão desta fila é sobre documento. Já houve um ramo de pessoa — o pedido de acesso,
 * espelhado do auth-service em `tenant_members` — que saiu junto com o próprio pedido: quem entra
 * numa empresa entra convidado, e convite não passa por fila.
 */
export type PendingApprovalKind =
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
export async function listPendingApprovalsForTenant(
  input: ListPendingApprovalsInput,
): Promise<{ items: PendingApprovalDto[]; nextCursor: string | null }> {
  if (!input.platformRoles.includes('company_admin')) {
    return { items: [], nextCursor: null };
  }

  const requests = await listApprovalRequests({
    tenantId: input.tenantId,
    decidableByUserId: input.userId,
    status: 'pending',
    limit: input.limit,
    cursor: input.cursor,
  });

  /**
   * Duas origens, uma fila: as aprovações no formato novo e os envios que ainda não migraram.
   *
   * Só as primeiras têm cursor. Enquanto a fila couber numa página — o caso de qualquer tenant
   * real hoje — a mistura não aparece; quando passar disso, as duas precisam paginar pela mesma
   * chave, e o caminho é o envio virar `MongoApprovalRequest` também.
   */
  const items = [
    ...requests.items.map(mapApprovalRequest),
    ...input.legacyUploadApprovals.map(mapLegacyUploadApproval),
  ].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  return { items, nextCursor: requests.nextCursor };
}
