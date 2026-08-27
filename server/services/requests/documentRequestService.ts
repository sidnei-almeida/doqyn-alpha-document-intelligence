import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { DocumentRequestStatus, MongoDocumentRequest } from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';
import { assertUserCanSubmitToCategoryId } from '../categoryUploadPermission.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { isInterTenantSharingEnabled } from '../../config/interTenantConfig.js';
import { lookupDirectoryUserByEmail } from '../../integrations/doqynAuthInternalClient.js';
import { resolveTenant } from '../../tenancy/tenantResolver.js';
import { notifyDocumentRequested } from '../notifications/documentRequestNotifications.js';

export const DOCUMENT_REQUEST_ID_PREFIX = 'dreq_';

const TITLE_MAX = 160;
const DESCRIPTION_MAX = 2000;

/**
 * Teto do prazo, em dias.
 *
 * Sem teto, um pedido com vencimento em dez anos nunca é varrido e a lista cresce para sempre —
 * a mesma lacuna já anotada para a fila de aprovações. O prazo é opcional; o teto vale quando ele
 * existe.
 */
const DUE_MAX_DAYS = 365;

const BLOCKED_MEMBER_STATUSES = new Set(['pending', 'blocked', 'rejected']);

async function getCollection(): Promise<Collection<MongoDocumentRequest>> {
  const db = await getDb();
  return db.collection<MongoDocumentRequest>(SHARED_APP_COLLECTIONS.documentRequests);
}

function assertMongo(): void {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }
}

type ResolvedParty = {
  userId: string;
  membershipId?: string;
  name: string;
  email: string;
};

/**
 * De quem se pede.
 *
 * Hoje só membro ativo do mesmo tenant — a Fase F abre para usuário DOQYN de outra empresa, e é
 * esta função que muda. O resto do serviço não conhece a fronteira.
 */
async function resolveRequestedFrom(
  tenantId: string,
  requesterUserId: string,
  targetUserId: string,
): Promise<ResolvedParty> {
  if (!targetUserId?.trim()) {
    throw new ServiceError('Informe de quem você está pedindo.', 'REQUEST_TARGET_REQUIRED', 400);
  }
  if (targetUserId === requesterUserId) {
    throw new ServiceError(
      'Não é possível pedir um documento para você mesmo.',
      'REQUEST_TARGET_SELF',
      400,
    );
  }

  const members = await listOperationalTenantMembers(tenantId);
  const member = members.map(serializeTenantMember).find((item) => item.userId === targetUserId);

  if (!member) {
    throw new ServiceError('Usuário não pertence a esta empresa.', 'REQUEST_TARGET_INVALID', 403);
  }
  if (BLOCKED_MEMBER_STATUSES.has(member.status)) {
    throw new ServiceError('Usuário indisponível.', 'REQUEST_TARGET_NOT_ACTIVE', 403);
  }
  if (!member.email?.trim()) {
    throw new ServiceError('Usuário sem e-mail válido.', 'REQUEST_TARGET_EMAIL_INVALID', 400);
  }

  return {
    userId: member.userId,
    membershipId: member.id,
    name: member.name,
    email: member.email,
  };
}

/**
 * De quem se pede, quando o e-mail aponta para fora.
 *
 * Membro de casa primeiro, sempre: o caminho de dentro já existe, não gasta chamada de rede e não
 * consome a cota que protege a fronteira. Só depois o diretório.
 *
 * O que volta de lá é o mínimo — id e nome de exibição. O e-mail que fica gravado no pedido é o
 * que quem pediu digitou, porque é o único que ele já conhecia.
 */
async function resolveRequestedFromEmail(
  tenantId: string,
  requester: { userId: string; email: string },
  rawEmail: string,
): Promise<{ party: ResolvedParty; external: boolean }> {
  const email = rawEmail.trim().toLowerCase();

  if (!email) {
    throw new ServiceError('Informe de quem você está pedindo.', 'REQUEST_TARGET_REQUIRED', 400);
  }
  if (email === requester.email?.trim().toLowerCase()) {
    throw new ServiceError(
      'Não é possível pedir um documento para você mesmo.',
      'REQUEST_TARGET_SELF',
      400,
    );
  }

  const members = await listOperationalTenantMembers(tenantId);
  const member = members
    .map(serializeTenantMember)
    .find((item) => item.email?.trim().toLowerCase() === email && Boolean(item.userId));

  if (member) {
    if (BLOCKED_MEMBER_STATUSES.has(member.status)) {
      throw new ServiceError('Usuário indisponível.', 'REQUEST_TARGET_NOT_ACTIVE', 403);
    }
    return {
      party: {
        userId: member.userId,
        membershipId: member.id,
        name: member.name,
        email: member.email,
      },
      external: false,
    };
  }

  if (!isInterTenantSharingEnabled()) {
    throw new ServiceError(
      'Esse e-mail não é de ninguém da sua empresa.',
      'REQUEST_TARGET_OUTSIDE_TENANT',
      400,
    );
  }

  const found = await lookupDirectoryUserByEmail(email);
  if (!found) {
    throw new ServiceError(
      'Esse e-mail não tem conta DOQYN. Só é possível pedir a quem já usa o sistema.',
      'REQUEST_TARGET_NOT_DOQYN',
      400,
    );
  }

  if (found.id === requester.userId) {
    throw new ServiceError(
      'Não é possível pedir um documento para você mesmo.',
      'REQUEST_TARGET_SELF',
      400,
    );
  }

  return {
    party: { userId: found.id, name: found.displayName, email },
    external: true,
  };
}

/**
 * A categoria de destino existe e está ativa.
 *
 * Validar aqui, e não na hora do envio, é o que impede um pedido que ninguém consegue cumprir:
 * quem recebe não escolhe a categoria, então uma categoria inválida travaria o envio sem que ele
 * pudesse corrigir.
 */
async function resolveCategory(
  ctx: DocumentRequestContext,
  categoryId: string,
): Promise<{ categoryId: string; categoryName?: string }> {
  if (!categoryId?.trim()) {
    throw new ServiceError('Informe a categoria de destino.', 'REQUEST_CATEGORY_REQUIRED', 400);
  }

  const { documentCategories } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  if (!documentCategories) {
    throw new ServiceError(
      'Categorias não disponíveis neste ambiente.',
      'REQUEST_CATEGORY_UNAVAILABLE',
      503,
    );
  }

  const category = await documentCategories.findOne({
    _id: categoryId,
    tenantId: ctx.tenantId,
  } as Record<string, unknown>);

  if (!category || category.active === false) {
    throw new ServiceError('Categoria não encontrada.', 'REQUEST_CATEGORY_NOT_FOUND', 404);
  }

  return { categoryId, categoryName: category.name };
}

function normalizeDueAt(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError('Prazo inválido.', 'REQUEST_DUE_INVALID', 400);
  }
  if (parsed.getTime() <= Date.now()) {
    throw new ServiceError('O prazo precisa estar no futuro.', 'REQUEST_DUE_PAST', 400);
  }
  if (parsed.getTime() > Date.now() + DUE_MAX_DAYS * 24 * 60 * 60 * 1000) {
    throw new ServiceError(
      `O prazo não pode passar de ${DUE_MAX_DAYS} dias.`,
      'REQUEST_DUE_TOO_FAR',
      400,
    );
  }
  return parsed;
}

export type CreateDocumentRequestInput = {
  /** Do seletor de pessoas da empresa. Um dos dois basta. */
  requestedFromUserId?: string;
  /** O caminho que atravessa a fronteira: o e-mail resolve para membro daqui ou usuário de fora. */
  requestedFromEmail?: string;
  title: string;
  description?: string;
  /** Obrigatória no pedido de dentro de casa; ignorada no pedido para fora. */
  categoryId?: string;
  dueAt?: string;
};

/** O nome da empresa de quem pede, copiado para que quem está fora saiba de onde veio. */
async function resolveRequesterTenantName(tenantId: string): Promise<string> {
  const tenant = await resolveTenant(tenantId);
  return tenant.displayName || tenantId;
}

export async function createDocumentRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  input: CreateDocumentRequestInput,
): Promise<MongoDocumentRequest> {
  assertMongo();

  const title = input.title?.trim();
  if (!title) {
    throw new ServiceError('Diga o que você está pedindo.', 'REQUEST_TITLE_REQUIRED', 400);
  }
  if (title.length > TITLE_MAX) {
    throw new ServiceError(
      `O título não pode passar de ${TITLE_MAX} caracteres.`,
      'REQUEST_TITLE_TOO_LONG',
      400,
    );
  }

  const description = input.description?.trim() || undefined;
  if (description && description.length > DESCRIPTION_MAX) {
    throw new ServiceError(
      `A descrição não pode passar de ${DESCRIPTION_MAX} caracteres.`,
      'REQUEST_DESCRIPTION_TOO_LONG',
      400,
    );
  }

  const dueAt = normalizeDueAt(input.dueAt);

  const resolved = input.requestedFromEmail?.trim()
    ? await resolveRequestedFromEmail(
        ctx.tenantId,
        { userId: user.id, email: user.email },
        input.requestedFromEmail,
      )
    : {
        party: await resolveRequestedFrom(
          ctx.tenantId,
          user.id,
          input.requestedFromUserId?.trim() ?? '',
        ),
        external: false,
      };

  const requestedFrom = resolved.party;

  /**
   * Pedido para fora não tem categoria de destino, e a verificação de quem pede cai junto.
   *
   * O documento vai nascer e morar no acervo de quem envia — nenhuma categoria daqui o alcança.
   * A checagem de permissão existe para sustentar a dispensa de quem cumpre, e ali não há dispensa
   * a sustentar: quem envia usa a governança da própria empresa, como em qualquer envio dele.
   */
  const category = resolved.external
    ? { categoryId: undefined, categoryName: undefined }
    : await resolveCategory(ctx, input.categoryId?.trim() ?? '');

  /**
   * Quem pede tem de alcançar a categoria de destino.
   *
   * Cumprir um pedido **dispensa** a permissão de envio de quem envia — é o que faz o funcionário
   * conseguir mandar o comprovante para a categoria do RH. Essa dispensa se apoia no pedido ser o
   * ato de autorização, e um ato de autorização só vale se quem o pratica tinha a autorização.
   * Sem esta verificação, duas pessoas sem alcance na categoria pediriam uma à outra e depositariam
   * nela, com a permissão de envio dispensada dos dois lados.
   */
  if (category.categoryId) {
    await assertUserCanSubmitToCategoryId({
      user,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      membershipId: ctx.membershipId,
      categoryId: category.categoryId,
      message: 'Você não tem permissão para pedir documentos nesta categoria.',
    });
  }

  const now = new Date();
  const request: MongoDocumentRequest = {
    _id: `${DOCUMENT_REQUEST_ID_PREFIX}${randomUUID()}`,
    tenantId: ctx.tenantId,
    companyId: ctx.tenantId,
    requestedBy: {
      userId: user.id,
      membershipId: ctx.membershipId,
      // `user.name` chega vazio na sessão do `doqyn_auth`: o nome se compõe de `firstName` e
      // `lastName`, e o campo cru deixaria um UUID na lista de quem recebe.
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email,
      email: user.email,
    },
    requestedFrom,
    ...(resolved.external
      ? { crossTenant: { requesterTenantName: await resolveRequesterTenantName(ctx.tenantId) } }
      : {}),
    title,
    ...(description ? { description } : {}),
    ...(category.categoryId ? { categoryId: category.categoryId } : {}),
    ...(category.categoryName ? { categoryName: category.categoryName } : {}),
    ...(dueAt ? { dueAt } : {}),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getCollection();
  await collection.insertOne(request);

  await notifyDocumentRequested(request);

  return request;
}

export type ListDocumentRequestsInput = {
  tenantId: string;
  userId: string;
  /** `received` é o que me pediram; `sent` é o que eu pedi. */
  direction: 'received' | 'sent';
  status?: DocumentRequestStatus;
  limit?: number;
  cursor?: string;
};

const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

export async function listDocumentRequests(
  input: ListDocumentRequestsInput,
): Promise<{ items: MongoDocumentRequest[]; nextCursor: string | null }> {
  if (!isMongoNativeConfigured()) {
    return { items: [], nextCursor: null };
  }

  const limit = Math.min(Math.max(input.limit ?? LIST_LIMIT_DEFAULT, 1), LIST_LIMIT_MAX);
  const ownerField = input.direction === 'sent' ? 'requestedBy.userId' : 'requestedFrom.userId';

  /**
   * O que eu **recebi** não filtra por empresa; o que eu **enviei**, sim.
   *
   * Um pedido feito por outra empresa nasce no tenant de quem pediu — filtrar pelo tenant da
   * sessão o esconderia justamente de quem tem de atendê-lo. O pedido é para a pessoa, e a lista
   * de recebidos é dela. Já a lista de enviados é do acervo de quem pede, e ali o tenant é o
   * recorte certo.
   */
  const filter: Record<string, unknown> =
    input.direction === 'sent'
      ? { tenantId: input.tenantId, [ownerField]: input.userId }
      : { [ownerField]: input.userId };
  if (input.status) filter.status = input.status;
  if (input.cursor) {
    // Cursor inválido é entrada do cliente, não erro do servidor: sem esta guarda a data inválida
    // entra na consulta e o driver estoura um erro que o handler repassa como 500.
    const cursorDate = new Date(input.cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      throw new ServiceError('Cursor inválido.', 'REQUEST_CURSOR_INVALID', 400);
    }
    // A lista sai do mais recente, então a página seguinte é o que veio antes.
    filter.createdAt = { $lt: cursorDate };
  }

  const collection = await getCollection();
  const items = await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null;

  return { items: page, nextCursor };
}

export async function getDocumentRequestById(
  tenantId: string,
  requestId: string,
): Promise<MongoDocumentRequest | null> {
  assertMongo();
  const collection = await getCollection();
  return collection.findOne({ _id: requestId, tenantId });
}

/**
 * Cancelar é de quem pediu, e só dele.
 *
 * Quem recebeu não cancela: recusar um pedido é outra conversa — e, por ora, ela acontece fora do
 * sistema. Deixar o destinatário cancelar apagaria da vista de quem pediu um pedido que ele ainda
 * considera aberto.
 */
export async function cancelDocumentRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  requestId: string,
): Promise<MongoDocumentRequest> {
  assertMongo();

  const collection = await getCollection();
  const existing = await collection.findOne({ _id: requestId, tenantId: ctx.tenantId });

  if (!existing) {
    throw new ServiceError('Pedido não encontrado.', 'REQUEST_NOT_FOUND', 404);
  }
  if (existing.requestedBy.userId !== user.id) {
    throw new ServiceError('Só quem pediu pode cancelar.', 'REQUEST_CANCEL_DENIED', 403);
  }
  if (existing.status !== 'pending') {
    throw new ServiceError('Este pedido já foi encerrado.', 'REQUEST_SETTLED', 409);
  }

  const now = new Date();
  const result = await collection.findOneAndUpdate(
    { _id: requestId, tenantId: ctx.tenantId, status: 'pending' },
    { $set: { status: 'cancelled', cancelledAt: now, updatedAt: now } },
    { returnDocument: 'after' },
  );

  if (!result) {
    // Perdeu a corrida: o pedido foi cumprido ou cancelado entre a leitura e a escrita.
    throw new ServiceError('Este pedido já foi encerrado.', 'REQUEST_SETTLED', 409);
  }

  return result;
}

/**
 * O pedido que este envio vai cumprir.
 *
 * Chamado **antes** de o documento existir, porque é daqui que sai o `classId`: quem pediu já
 * disse onde o documento mora, e essa escolha vence a da IA e a de quem envia. É o que separa a
 * requisição de um upload comum, e onde a governança do que entra fica decidida.
 *
 * Só o destinatário cumpre. Um terceiro que soubesse o id do pedido poderia, de outro modo,
 * depositar documento na categoria escolhida por quem pediu.
 */
export async function resolveRequestForFulfillment(
  tenantId: string,
  userId: string,
  requestId: string,
): Promise<MongoDocumentRequest> {
  assertMongo();

  const collection = await getCollection();
  /**
   * O pedido é buscado pelo id, sem recorte de empresa.
   *
   * Um pedido feito de fora vive no tenant de quem pediu, e quem vai cumpri-lo está no dele.
   * Exigir `tenantId` aqui recusaria com "não encontrado" exatamente o pedido que a pessoa está
   * tentando atender. Quem autoriza é a linha abaixo: o pedido tem de ser dela.
   */
  void tenantId;
  const request = await collection.findOne({ _id: requestId });

  if (!request) {
    throw new ServiceError('Pedido não encontrado.', 'REQUEST_NOT_FOUND', 404);
  }
  if (request.requestedFrom.userId !== userId) {
    throw new ServiceError('Este pedido não é seu.', 'REQUEST_FULFILL_DENIED', 403);
  }
  if (request.status !== 'pending') {
    throw new ServiceError('Este pedido já foi encerrado.', 'REQUEST_SETTLED', 409);
  }

  return request;
}

/**
 * Fecha o pedido com o documento que o cumpriu.
 *
 * Condicionado a `status: 'pending'` para que dois envios simultâneos não marquem o mesmo pedido
 * duas vezes. Devolve `null` quando perde a corrida — quem chama decide o que fazer, e no caminho
 * do upload a resposta certa é seguir: o documento já existe, e perder o arquivo por causa da
 * marcação seria trocar um problema pequeno por um grande.
 */
export async function markDocumentRequestFulfilled(
  tenantId: string,
  requestId: string,
  documentId: string,
): Promise<MongoDocumentRequest | null> {
  const collection = await getCollection();
  const now = new Date();

  // Mesma razão de `resolveRequestForFulfillment`: o pedido de fora vive no tenant de quem pediu.
  void tenantId;
  return collection.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    {
      $set: {
        status: 'fulfilled',
        fulfilledDocumentId: documentId,
        fulfilledAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );
}

/**
 * Vence os pedidos cujo prazo passou.
 *
 * Um `updateMany` só, sem laço por tenant: `document_requests` é coleção compartilhada e o índice
 * `{ status, dueAt }` existe justamente para esta consulta. Varrer tenant a tenant faria N leituras
 * onde uma basta.
 *
 * Pedido **sem** prazo nunca vence — não há o que vencer, e inventar um prazo padrão fecharia
 * sozinho pedidos que ninguém decidiu encerrar. A dívida do crescimento sem limite fica paga só
 * para quem tem prazo; o resto sai da lista por cancelamento ou por ser atendido.
 */
export async function expireOverdueDocumentRequests(now = new Date()): Promise<number> {
  if (!isMongoNativeConfigured()) return 0;

  const collection = await getCollection();
  const result = await collection.updateMany(
    { status: 'pending', dueAt: { $lte: now } },
    { $set: { status: 'expired', updatedAt: now } },
  );

  return result.modifiedCount;
}
