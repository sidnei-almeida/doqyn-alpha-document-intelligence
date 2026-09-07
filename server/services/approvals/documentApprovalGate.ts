import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { ApprovalRequestKind, MongoApprovalRequest, MongoDocument } from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { createApprovalRequest } from './approvalRequestService.js';

/**
 * Aprovar um download não re-executa nada.
 *
 * Foi a diferença que o plano não previu: para envio, aprovar publica o documento — há um efeito a
 * disparar. Para download, o efeito é do lado de quem pediu, e acontece depois. O que a aprovação
 * deixa é **licença**, e é ela que este portão consulta.
 *
 * A licença é o próprio pedido aprovado. Não existe coleção nova: `approval_requests` já guarda
 * quem pediu, sobre o quê, e como terminou.
 */
const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ApprovalGateOutcome =
  | { state: 'allowed' }
  | { state: 'pending'; requestId: string }
  | { state: 'requested'; requestId: string };

async function findSettledRequest(input: {
  tenantId: string;
  userId: string;
  documentId: string;
  kind: ApprovalRequestKind;
  status: 'pending' | 'approved';
  targetMemberId?: string;
}): Promise<MongoApprovalRequest | null> {
  const db = await getDb();
  return db.collection<MongoApprovalRequest>(SHARED_APP_COLLECTIONS.approvalRequests).findOne(
    {
      tenantId: input.tenantId,
      kind: input.kind,
      status: input.status,
      'requestedBy.userId': input.userId,
      'subject.documentId': input.documentId,
      // Pedido com destinatário só casa com o mesmo destinatário. Sem este termo, pedir para
      // compartilhar com Ana devolveria o pedido pendente feito para Bruno.
      ...(input.targetMemberId ? { 'subject.memberId': input.targetMemberId } : {}),
      ...(input.status === 'approved'
        ? { decidedAt: { $gte: new Date(Date.now() - APPROVAL_TTL_MS) } }
        : {}),
    } as Record<string, unknown>,
    { sort: { createdAt: -1 } },
  );
}

/**
 * Resolve o meio-termo para uma ação sobre um documento.
 *
 * Devolve `allowed` quando já há aprovação válida, `pending` quando o pedido está na fila, e
 * `requested` quando acabou de criar um. Nunca devolve negado: chegar aqui já significa que a
 * governança disse "pode, pedindo".
 *
 * A licença aprovada vale por sete dias. Sem prazo, uma aprovação de agosto liberaria o mesmo
 * documento em dezembro sem ninguém olhar de novo — o oposto do que o administrador quis ao
 * escolher o meio-termo.
 */
export async function resolveDocumentApproval(input: {
  tenantId: string;
  membershipId?: string;
  user: AuthUser;
  doc: Pick<MongoDocument, '_id' | 'classId' | 'className' | 'currentFileName'>;
  kind: ApprovalRequestKind;
  /** A quem a ação se dirige, quando há um segundo lado — o destinatário de um compartilhamento. */
  target?: { memberId: string; memberName?: string };
  /** O necessário para executar a ação ao aprovar. Vazio quando aprovar só concede licença. */
  payload?: Record<string, unknown>;
  /**
   * Se a aprovação vale como passe para a próxima tentativa.
   *
   * Verdadeiro no download, onde o efeito é de quem pediu e acontece depois. Falso no
   * compartilhamento: lá aprovar **executa** a ação, e tratar o pedido aprovado como licença
   * faria a mesma aprovação valer para um segundo compartilhamento que ninguém viu.
   */
  grantsLicense?: boolean;
}): Promise<ApprovalGateOutcome> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const { tenantId, user, doc, kind } = input;
  const documentId = doc._id;

  const targetMemberId = input.target?.memberId;

  if (input.grantsLicense !== false) {
    const approved = await findSettledRequest({
      tenantId,
      userId: user.id,
      documentId,
      kind,
      status: 'approved',
      targetMemberId,
    });
    if (approved) return { state: 'allowed' };
  }

  const pending = await findSettledRequest({
    tenantId,
    userId: user.id,
    documentId,
    kind,
    status: 'pending',
    targetMemberId,
  });
  if (pending) return { state: 'pending', requestId: pending._id };

  const created = await createApprovalRequest({
    tenantId,
    companyId: tenantId,
    kind,
    requestedBy: {
      userId: user.id,
      membershipId: input.membershipId,
      name: user.name,
      email: user.email,
    },
    subject: {
      documentId,
      documentName: doc.currentFileName ?? undefined,
      categoryId: doc.classId ?? undefined,
      categoryName: doc.className ?? undefined,
      memberId: input.target?.memberId,
      memberName: input.target?.memberName,
    },
    payload: input.payload ?? {},
  });

  return { state: 'requested', requestId: created._id };
}
