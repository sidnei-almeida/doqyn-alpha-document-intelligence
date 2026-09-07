import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  ApprovalRequestKind,
  ApprovalRequestStatus,
  MongoApprovalRequest,
  MongoTenantMember,
} from '../../db/types.js';
import { notifyApprovalRequested } from '../notifications/approvalNotifications.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { ServiceError } from '../../utils/serviceErrors.js';

export const APPROVAL_REQUEST_ID_PREFIX = 'apr_';

async function getApprovalRequestsCollection(): Promise<Collection<MongoApprovalRequest>> {
  const db = await getDb();
  return db.collection<MongoApprovalRequest>(SHARED_APP_COLLECTIONS.approvalRequests);
}

function assertMongo(): void {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }
}

function memberUserId(member: MongoTenantMember): string {
  return member.authUserId ?? member.memberId;
}

/**
 * Quem pode decidir um pedido, resolvido na criação.
 *
 * É a única linha que sabe a política de aprovador, e por isso ela existe: hoje devolve os
 * `company_admin` ativos do tenant, e o produto não fala do assunto — não há tela nem
 * configuração. Se um dia o aprovador variar por escopo (o dono da categoria decide o que é da
 * categoria dele), muda aqui e a fila, a tela, a notificação e a trilha continuam iguais.
 *
 * Não recebe o `kind` porque hoje a resposta não depende dele. Quando depender, ele entra aqui e
 * em `createApprovalRequest`, que é o único chamador.
 */
export async function resolveApprovers(tenantId: string): Promise<string[]> {
  const members = await listOperationalTenantMembers(tenantId);
  return members
    .filter((member) => member.status === 'active' && member.tenantRoles.includes('company_admin'))
    .map(memberUserId);
}

export type CreateApprovalRequestInput = {
  tenantId: string;
  companyId: string;
  kind: ApprovalRequestKind;
  requestedBy: MongoApprovalRequest['requestedBy'];
  subject: MongoApprovalRequest['subject'];
  payload: Record<string, unknown>;
};

export async function createApprovalRequest(
  input: CreateApprovalRequestInput,
): Promise<MongoApprovalRequest> {
  assertMongo();

  const decidableBy = await resolveApprovers(input.tenantId);

  // Sem aprovador o pedido nasceria invisível: ninguém o veria na fila, e ele ficaria pendente
  // para sempre. É estado inconsistente do tenant, não erro de quem pediu — recusar aqui, com
  // mensagem que diz o que houve, é melhor do que gravar um pedido que nunca será decidido.
  if (decidableBy.length === 0) {
    throw new ServiceError(
      'Esta empresa não tem administrador ativo para aprovar o pedido.',
      'APPROVAL_NO_APPROVER',
      409,
    );
  }

  const now = new Date();
  const request: MongoApprovalRequest = {
    _id: `${APPROVAL_REQUEST_ID_PREFIX}${randomUUID()}`,
    tenantId: input.tenantId,
    companyId: input.companyId,
    kind: input.kind,
    status: 'pending',
    requestedBy: input.requestedBy,
    subject: input.subject,
    payload: input.payload,
    decidableBy,
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getApprovalRequestsCollection();

  try {
    await collection.insertOne(request);
  } catch (error) {
    // Dois cliques no mesmo botão, ou duas abas. O índice único é quem resolve a corrida; aqui só
    // devolvemos o pedido que ganhou, em vez de estourar um erro que o usuário não causou.
    if ((error as { code?: number }).code === 11000) {
      const existing = await collection.findOne({
        tenantId: input.tenantId,
        kind: input.kind,
        status: 'pending',
        'requestedBy.userId': input.requestedBy.userId,
        'subject.documentId': input.subject.documentId,
        // O destinatário faz parte da identidade do pedido em `document_share`: sem ele, o
        // pedido devolvido poderia ser o de outra pessoa no mesmo documento.
        'subject.memberId': input.subject.memberId ?? null,
      } as Record<string, unknown>);
      if (existing) return existing;
    }
    throw error;
  }

  await notifyApprovalRequested(request);
  return request;
}

export type ListApprovalRequestsInput = {
  tenantId: string;
  /** Só o que esta pessoa pode decidir. Omitir devolve a fila inteira do tenant. */
  decidableByUserId?: string;
  status?: ApprovalRequestStatus;
  limit?: number;
  cursor?: string;
};

const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

export async function listApprovalRequests(
  input: ListApprovalRequestsInput,
): Promise<{ items: MongoApprovalRequest[]; nextCursor: string | null }> {
  if (!isMongoNativeConfigured()) {
    return { items: [], nextCursor: null };
  }

  const limit = Math.min(Math.max(input.limit ?? LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);

  const filter: Record<string, unknown> = {
    tenantId: input.tenantId,
    status: input.status ?? 'pending',
  };
  if (input.decidableByUserId) {
    filter.decidableBy = input.decidableByUserId;
  }
  if (input.cursor) {
    // Quem espera há mais tempo vem antes, então a página seguinte é o que veio depois.
    filter.createdAt = { $gt: new Date(input.cursor) };
  }

  const collection = await getApprovalRequestsCollection();
  const items = await collection
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null;

  return { items: page, nextCursor };
}

export async function getApprovalRequestById(
  tenantId: string,
  requestId: string,
): Promise<MongoApprovalRequest | null> {
  assertMongo();
  const collection = await getApprovalRequestsCollection();
  return collection.findOne({ _id: requestId, tenantId });
}

export type DecideApprovalRequestInput = {
  tenantId: string;
  requestId: string;
  decidedByUserId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
};

/**
 * Fecha o pedido, e só isso.
 *
 * Executar o efeito da aprovação é responsabilidade de quem conhece o `kind` — publicar o
 * documento, conceder o compartilhamento. Aqui o registro é marcado primeiro, num `updateOne`
 * condicionado a `status: 'pending'`, para que dois administradores decidindo ao mesmo tempo não
 * disparem o efeito duas vezes.
 */
export async function decideApprovalRequest(
  input: DecideApprovalRequestInput,
): Promise<MongoApprovalRequest> {
  assertMongo();

  if (input.decision === 'rejected' && !input.reason?.trim()) {
    throw new ServiceError('Informe o motivo da recusa.', 'APPROVAL_REASON_REQUIRED', 400);
  }

  const collection = await getApprovalRequestsCollection();
  const existing = await collection.findOne({ _id: input.requestId, tenantId: input.tenantId });

  if (!existing) {
    throw new ServiceError('Pedido não encontrado.', 'APPROVAL_REQUEST_NOT_FOUND', 404);
  }
  if (!existing.decidableBy.includes(input.decidedByUserId)) {
    throw new ServiceError(
      'Você não pode decidir este pedido.',
      'APPROVAL_REQUEST_ACCESS_DENIED',
      403,
    );
  }
  if (existing.status !== 'pending') {
    throw new ServiceError('Este pedido já foi decidido.', 'APPROVAL_REQUEST_SETTLED', 409);
  }

  const result = await collection.findOneAndUpdate(
    { _id: input.requestId, tenantId: input.tenantId, status: 'pending' },
    {
      $set: {
        status: input.decision,
        decidedBy: input.decidedByUserId,
        decidedAt: new Date(),
        updatedAt: new Date(),
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    // Perdeu a corrida para outro administrador entre o `findOne` e o `findOneAndUpdate`.
    throw new ServiceError('Este pedido já foi decidido.', 'APPROVAL_REQUEST_SETTLED', 409);
  }

  return result;
}

/**
 * Devolve um pedido decidido à fila.
 *
 * Serve à compensação: a decisão é gravada antes do efeito para que dois administradores não o
 * disparem duas vezes, e quando o efeito falha o pedido não pode ficar aprovado sem ter
 * acontecido. Reabrir é mais honesto do que registrar uma aprovação que não produziu nada.
 */
export async function reopenApprovalRequest(tenantId: string, requestId: string): Promise<void> {
  const collection = await getApprovalRequestsCollection();
  await collection.updateOne(
    { _id: requestId, tenantId },
    {
      $set: { status: 'pending', updatedAt: new Date() },
      $unset: { decidedBy: '', decidedAt: '', reason: '' },
    },
  );
}
