import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS, REGISTRY_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  DocumentSharePermissions,
  InboundShareState,
  MongoDocument,
  MongoDocumentShareGrant,
  MongoTenantMember,
} from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import type { GovernanceAccessIndex } from '../../tenancy/governanceAccessIndex.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import { isDocumentAdmin, loadDocumentAccessContext } from '../../tenancy/documentAccess.js';
import {
  canUserShareDocument,
  canUserListDocumentWithShare,
  resolveDocumentPermissionsWithShare,
  shareRequiresApproval,
} from '../../tenancy/documentShareAccess.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { buildDocumentListItems } from '../documentListItems.js';
import { attachFavoriteFlags, lookupFavoriteFlags } from '../favorites/documentFavoritesService.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { isInterTenantSharingEnabled } from '../../config/interTenantConfig.js';
import { resolveExternalSharingConfig } from '../../config/externalSharingConfig.js';
import { resolveTenant } from '../../tenancy/tenantResolver.js';
import { notifyInboundShareReceived } from '../notifications/inboundShareNotifications.js';
import { lookupDirectoryUserByEmail } from '../../integrations/doqynAuthInternalClient.js';
import { notifyDocumentShared } from '../notifications/documentNotifications.js';
import { getTenantIdFromUser } from '../../auth/tenantContext.js';
import { resolveDocumentApproval } from '../approvals/documentApprovalGate.js';
import type { MongoApprovalRequest } from '../../db/types.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

function defaultSharePermissions(
  input?: Partial<DocumentSharePermissions>,
): DocumentSharePermissions {
  return {
    canView: input?.canView !== false,
    canDownload: input?.canDownload === true,
    canShare: false,
  };
}

async function getShareGrantsCollection(): Promise<Collection<MongoDocumentShareGrant>> {
  const db = await getDb();
  return db.collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants);
}

/**
 * Concessão que vale agora.
 *
 * Este filtro é o gargalo por onde **todo** acesso por compartilhamento passa: a Biblioteca de quem
 * recebe, "Compartilhados comigo" e a autorização de ver e baixar. Por isso a caixa de entrada
 * mora aqui e não em cada consumidor — barrar num lugar só é o que garante que um item pendente
 * não escape por um caminho que ninguém lembrou de ajustar.
 *
 * Concessão sem `inbound` é de casa e vale na hora. Com `inbound`, só depois do aceite.
 *
 * `$and` em vez de dois `$or` soltos: o segundo sobrescreveria o primeiro no mesmo objeto, e a
 * validade deixaria de ser conferida sem que nada quebrasse.
 */
function activeGrantFilter(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'active',
    ...extra,
    $and: [
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      {
        $or: [{ inbound: { $exists: false } }, { 'inbound.status': 'accepted' }],
      },
    ],
  };
}

export async function findActiveShareGrantForUser(
  documentId: string,
  sharedWithUserId: string,
): Promise<MongoDocumentShareGrant | null> {
  if (!isMongoNativeConfigured() || !sharedWithUserId) return null;
  const collection = await getShareGrantsCollection();
  return collection.findOne(
    activeGrantFilter({ documentId, sharedWithUserId }) as Record<string, unknown>,
  );
}

export async function findActiveShareGrantsForUser(
  sharedWithUserId: string,
  tenantId: string,
): Promise<MongoDocumentShareGrant[]> {
  if (!isMongoNativeConfigured()) return [];
  const collection = await getShareGrantsCollection();
  return collection
    .find(activeGrantFilter({ sharedWithUserId, tenantId }) as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findActiveShareGrantsForDocument(
  documentId: string,
): Promise<MongoDocumentShareGrant[]> {
  if (!isMongoNativeConfigured()) return [];
  const collection = await getShareGrantsCollection();
  return collection
    .find(activeGrantFilter({ documentId }) as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * O que vale **e** o que foi oferecido e ainda espera resposta.
 *
 * Consulta separada de propósito: `activeGrantFilter` é o portão da autorização e não pode
 * afrouxar para servir uma tela. O que quem enviou precisa ver não é acesso concedido — é o
 * estado do gesto dele. Sem isto, compartilhar para fora somia da lista logo depois do aviso de
 * sucesso, e a tela dizia "ninguém tem acesso" para quem acabou de compartilhar.
 */
async function findShareGrantsForDocumentIncludingPending(
  documentId: string,
): Promise<MongoDocumentShareGrant[]> {
  if (!isMongoNativeConfigured()) return [];
  const collection = await getShareGrantsCollection();
  return collection
    .find({
      documentId,
      status: 'active',
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();
}

async function resolveActiveTenantMemberByUserId(
  tenantId: string,
  userId: string,
): Promise<MongoTenantMember | null> {
  await listOperationalTenantMembers(tenantId);

  const db = await getDb();
  const member =
    (await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
      tenantId,
      status: 'active',
      $or: [{ authUserId: userId }, { memberId: userId }],
    })) ?? null;

  return member;
}

async function loadShareableDocument(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
): Promise<{
  doc: MongoDocument;
  memberGroupIds: string[];
  governanceIndex: GovernanceAccessIndex;
  /** A governança disse "pode, pedindo". Só quem sabe abrir pedido consulta este campo. */
  requiresApproval: boolean;
}> {
  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  if (doc.deletedAt) {
    throw new ServiceError(
      'Documentos na lixeira não podem ser compartilhados.',
      'DOCUMENT_TRASHED',
      409,
    );
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  // O índice de governança é obrigatório aqui: sem ele o verbo `share` configurado pelo tenant não
  // é consultado e sobram apenas admin e dono, tornando a coluna do mapa de regras inerte.
  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });

  const canShare = canUserShareDocument(
    user,
    doc as MongoDocument,
    memberGroupIds,
    governanceIndex,
  );
  const requiresApproval =
    !canShare && shareRequiresApproval(user, doc as MongoDocument, memberGroupIds, governanceIndex);

  // Negar segue sendo o caminho comum; o meio-termo atravessa para quem sabe abrir pedido. Quem
  // só lê (`listDocumentShareGrants`) não sabe, e por isso trata `requiresApproval` como negativa.
  if (!canShare && !requiresApproval) {
    throw new ServiceError(
      'Você não tem permissão para compartilhar este documento.',
      'DOCUMENT_SHARE_DENIED',
      403,
    );
  }

  return {
    doc: doc as MongoDocument,
    memberGroupIds,
    governanceIndex,
    requiresApproval,
  };
}

export async function searchShareableTenantUsers(
  ctx: DocumentRequestContext,
  user: AuthUser,
  query?: string,
  documentId?: string,
) {
  const members = await listOperationalTenantMembers(ctx.tenantId);
  const active = members.filter((member) => member.status === 'active');

  const existingSharedIds = new Set<string>();
  if (documentId) {
    const grants = await findActiveShareGrantsForDocument(documentId);
    for (const grant of grants) {
      existingSharedIds.add(grant.sharedWithUserId);
    }
  }

  const q = query?.trim().toLowerCase() ?? '';
  const results = active
    .map(serializeTenantMember)
    .filter((member) => {
      const memberUserId = member.userId;
      if (!memberUserId || memberUserId === user.id) return false;
      if (!q) return true;
      const haystack = [
        member.name,
        member.email,
        member.firstName,
        member.lastName,
        member.username,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, 25)
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      alreadyShared: existingSharedIds.has(member.userId),
    }));

  return { users: results };
}

export async function listDocumentShareGrants(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  // Quem depende de aprovação para compartilhar continua vendo com quem o documento já está
  // compartilhado: é leitura, e negá-la trancaria o painel antes de a pessoa conseguir pedir.
  // `loadShareableDocument` já recusou quem não tem caminho nenhum.
  await loadShareableDocument(ctx, user, documentId);

  const grants = await findShareGrantsForDocumentIncludingPending(documentId);
  const members = await listOperationalTenantMembers(ctx.tenantId);
  const memberByUserId = new Map<string, ReturnType<typeof serializeTenantMember>>();

  for (const member of members) {
    const serialized = serializeTenantMember(member);
    if (serialized.userId) memberByUserId.set(serialized.userId, serialized);
  }

  return {
    documentId,
    shares: grants.map((grant) => {
      const recipient = memberByUserId.get(grant.sharedWithUserId);
      return {
        shareId: grant._id,
        sharedWithUserId: grant.sharedWithUserId,
        // Quem é de outra empresa não está na lista de membros daqui; o nome veio junto da oferta.
        sharedWithName:
          recipient?.name ?? grant.inbound?.offer.recipientName ?? grant.sharedWithUserId,
        sharedWithEmail: recipient?.email,
        permissions: grant.permissions,
        message: grant.message ?? null,
        createdAt: grant.createdAt.toISOString(),
        sharedByUserId: grant.sharedByUserId,
        expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
        // Ausente quando o compartilhamento é de casa: lá não há o que esperar.
        inboundStatus: grant.inbound?.status ?? null,
        originTenantName: grant.inbound?.offer.originTenantName ?? null,
      };
    }),
  };
}

type ShareGrantResult = {
  shareId: string;
  documentId: string;
  sharedWithUserId: string;
  permissions: DocumentSharePermissions;
  updated: boolean;
  currentVersionId?: string;
};

/**
 * Grava a concessão, e nada mais.
 *
 * Existe separada porque o compartilhamento tem vários autores possíveis: quem clicou, o
 * administrador aprovando um pedido em nome de quem clicou, e o próprio sistema cumprindo uma
 * requisição de documento. A autorização é de cada caminho; a escrita é a mesma.
 */
async function persistShareGrant(input: {
  ctx: DocumentRequestContext;
  // O que a concessão realmente lê. Pedir o `MongoDocument` inteiro obrigaria quem acabou de
  // criar um documento a remontá-lo só para conceder acesso a ele.
  doc: Pick<MongoDocument, '_id' | 'currentVersionId' | 'title' | 'currentFileName'>;
  sharedByUserId: string;
  sharedByName: string;
  sharedWithUserId: string;
  permissions: DocumentSharePermissions;
  message?: string | null;
  /**
   * Se a concessão avisa o destinatário.
   *
   * Falso quando o fato já tem aviso próprio: cumprir uma requisição avisa "seu pedido foi
   * atendido", e um "documento compartilhado com você" em cima disso contaria o mesmo fato duas
   * vezes, com a palavra errada.
   */
  notify?: boolean;
  /**
   * Presente só quando a concessão atravessa a fronteira do tenant.
   *
   * Com ela, a concessão nasce **pendente**: existe, mas não concede nada até o aceite. Sem ela, a
   * concessão é de casa e vale na hora.
   */
  inbound?: InboundShareState;
  /** Prazo da concessão, como no link externo. Ausente é sem prazo. */
  expiresAt?: Date | null;
}): Promise<ShareGrantResult> {
  const { ctx, doc, sharedWithUserId, permissions } = input;
  const documentId = doc._id;
  const collection = await getShareGrantsCollection();
  const now = new Date();

  const existing = await collection.findOne(
    activeGrantFilter({ documentId, sharedWithUserId }) as Record<string, unknown>,
  );

  if (existing) {
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          permissions,
          message: input.message?.trim() || null,
          updatedAt: now,
        },
      },
    );
    return {
      shareId: existing._id,
      documentId,
      sharedWithUserId,
      permissions,
      updated: true,
      currentVersionId: doc.currentVersionId,
    };
  }

  const grant: MongoDocumentShareGrant = {
    _id: `share_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    documentId,
    tenantId: ctx.tenantId,
    documentTenantType: ctx.tenantType === 'individual' ? 'individual' : 'business',
    sharedByUserId: input.sharedByUserId,
    sharedWithUserId,
    permissions,
    status: 'active',
    message: input.message?.trim() || null,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    revokedBy: null,
    expiresAt: input.expiresAt ?? null,
    ...(input.inbound ? { inbound: input.inbound } : {}),
  };

  await collection.insertOne(grant);

  /**
   * O que chegou de fora ainda não foi compartilhado: foi **oferecido**.
   *
   * Chamar isso de "documento compartilhado com você" antes do aceite prometeria um acesso que
   * ainda não existe, e o link do aviso levaria a uma ficha que a autorização recusa.
   */
  if (input.notify !== false && grant.inbound) {
    await notifyInboundShareReceived(grant);
  }

  // Só o compartilhamento novo avisa. Reenviar para a mesma pessoa cai no `updated` acima e não
  // gera aviso — a chave do fato é o id da concessão, e repetir o gesto não é fato novo.
  if (input.notify !== false && !grant.inbound) {
    await notifyDocumentShared({
      tenantId: ctx.tenantId,
      recipientUserId: sharedWithUserId,
      shareId: grant._id,
      documentId,
      documentName: doc.title || doc.currentFileName || documentId,
      actorUserId: input.sharedByUserId,
      actorName: input.sharedByName,
      canDownload: permissions.canDownload,
      message: grant.message,
    });
  }

  return {
    shareId: grant._id,
    documentId,
    sharedWithUserId,
    permissions,
    updated: false,
    currentVersionId: doc.currentVersionId,
  };
}

/**
 * Dá a quem pediu acesso ao documento que cumpriu o pedido.
 *
 * **Pedir é o ato de autorização.** Quem requisitou pode não alcançar a categoria de destino pela
 * governança — e mesmo assim precisa ver o que pediu, senão o pedido não serviu para nada. A
 * concessão explícita é o caminho certo para isso: passa pelo mesmo `document_share_grants` de
 * sempre, aparece na lista de compartilhamentos do documento, e é revogável. A alternativa seria
 * uma exceção nova dentro da autorização, invisível para quem lê as regras.
 *
 * Só leitura: o pedido justifica ver o que chegou, não mexer nele.
 */
export async function grantRequesterAccessToFulfilledDocument(input: {
  ctx: DocumentRequestContext;
  doc: Pick<MongoDocument, '_id' | 'currentVersionId' | 'title' | 'currentFileName'>;
  requesterUserId: string;
  fulfilledByUserId: string;
  fulfilledByName: string;
}): Promise<ShareGrantResult> {
  return persistShareGrant({
    ctx: input.ctx,
    doc: input.doc,
    sharedByUserId: input.fulfilledByUserId,
    sharedByName: input.fulfilledByName,
    sharedWithUserId: input.requesterUserId,
    permissions: { canView: true, canDownload: true, canShare: false },
    // O aviso deste fato é "seu pedido foi atendido", e ele sai do serviço de requisição.
    notify: false,
  });
}

async function requireShareRecipient(
  tenantId: string,
  sharedWithUserId: string,
): Promise<MongoTenantMember> {
  const recipient = await resolveActiveTenantMemberByUserId(tenantId, sharedWithUserId);
  if (!recipient) {
    throw new ServiceError(
      'Usuário de destino não encontrado ou inativo neste ambiente.',
      'SHARE_RECIPIENT_INVALID',
      400,
    );
  }
  return recipient;
}

/**
 * Para quem se está compartilhando: alguém de casa, ou alguém de outra empresa.
 *
 * `requireShareRecipient` deixou de ser a única porta. Quando o e-mail resolve para um usuário
 * DOQYN que não é membro deste tenant, o destino é válido — só que atravessa a fronteira, e o que
 * atravessa a fronteira não entra no acervo do outro lado sem aceite (Fase C).
 *
 * A ordem é deliberada: membro de casa primeiro, sempre. O caminho de dentro já existe, não gasta
 * chamada de rede e não consome a cota que protege a fronteira de fora.
 */
type ResolvedShareRecipient =
  | { scope: 'internal'; userId: string; name: string }
  | { scope: 'external_tenant'; userId: string; name: string };

async function resolveShareRecipient(
  tenantId: string,
  input: { sharedWithUserId?: string; sharedWithEmail?: string },
): Promise<ResolvedShareRecipient> {
  const userId = input.sharedWithUserId?.trim();
  const email = input.sharedWithEmail?.trim().toLowerCase();

  if (userId) {
    const member = await resolveActiveTenantMemberByUserId(tenantId, userId);
    if (member) {
      return {
        scope: 'internal',
        userId: member.authUserId ?? userId,
        name: serializeTenantMember(member).name,
      };
    }
  }

  if (email) {
    const members = await listOperationalTenantMembers(tenantId);
    const member = members
      .filter((item) => item.status === 'active')
      .map(serializeTenantMember)
      .find((item) => item.email?.trim().toLowerCase() === email && Boolean(item.userId));

    if (member) {
      return { scope: 'internal', userId: member.userId, name: member.name };
    }

    if (!isInterTenantSharingEnabled()) {
      throw new ServiceError(
        'Esse e-mail não é de ninguém da sua empresa. Use o link externo para enviar.',
        'SHARE_RECIPIENT_OUTSIDE_TENANT',
        400,
      );
    }

    const found = await lookupDirectoryUserByEmail(email);
    if (found) {
      return { scope: 'external_tenant', userId: found.id, name: found.displayName };
    }

    throw new ServiceError(
      'Esse e-mail não tem conta DOQYN. Use o link externo para enviar.',
      'SHARE_RECIPIENT_NOT_DOQYN',
      400,
    );
  }

  throw new ServiceError(
    'Usuário de destino não encontrado ou inativo neste ambiente.',
    'SHARE_RECIPIENT_INVALID',
    400,
  );
}

/**
 * Prazo da concessão, com teto para o que sai da empresa.
 *
 * Mesmo raciocínio do link externo: o acesso concedido não é reavaliado depois — nem quando quem
 * concedeu deixa a empresa —, então a validade é o único mecanismo que o fecha sozinho. Dentro de
 * casa a governança continua valendo todo dia e o prazo é opcional; para fora, sem teto ele seria
 * indefinido na prática.
 */
function resolveShareExpiration(
  raw: string | undefined,
  crossesTenantBorder: boolean,
): Date | null {
  if (!raw?.trim()) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError('Prazo inválido.', 'SHARE_EXPIRATION_INVALID', 400);
  }
  if (parsed.getTime() <= Date.now()) {
    throw new ServiceError('O prazo precisa estar no futuro.', 'SHARE_EXPIRATION_PAST', 400);
  }

  if (crossesTenantBorder) {
    const maxDays = resolveExternalSharingConfig().maxExternalShareExpirationDays;
    if (parsed.getTime() > Date.now() + maxDays * 24 * 60 * 60 * 1000) {
      throw new ServiceError(
        `O prazo não pode passar de ${maxDays} dias para fora da empresa.`,
        'SHARE_EXPIRATION_TOO_FAR',
        400,
      );
    }
  }

  return parsed;
}

/**
 * O essencial da oferta, copiado no envio.
 *
 * Quem vai decidir está fora deste tenant e não alcança nem o documento nem o cadastro da empresa
 * que enviou. Descobrir o nome de qualquer um dos dois na hora de listar exigiria a leitura
 * cross-tenant que o aceite ainda não concedeu.
 */
async function buildInboundState(
  ctx: DocumentRequestContext,
  doc: Pick<MongoDocument, '_id' | 'title' | 'currentFileName'>,
  sharedByName: string,
  recipientName: string,
): Promise<InboundShareState> {
  const tenant = await resolveTenant(ctx.tenantId);

  return {
    status: 'pending',
    // Preenchido no aceite: a oferta é para a **pessoa**, e ela pode ter mais de uma empresa. Qual
    // delas recebe o documento é escolha de quem aceita, não de quem envia.
    recipientTenantId: '',
    offer: {
      documentName: doc.title || doc.currentFileName || String(doc._id),
      sharedByName,
      originTenantName: tenant.displayName || ctx.tenantId,
      recipientName,
    },
  };
}

function assertSharePermissions(permissions: DocumentSharePermissions): void {
  if (!permissions.canView) {
    throw new ServiceError(
      'canView é obrigatório para compartilhamento.',
      'INVALID_SHARE_PERMISSIONS',
      400,
    );
  }
}

export async function createDocumentShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  input: {
    sharedWithUserId?: string;
    /** O caminho que atravessa a fronteira: o e-mail resolve para membro daqui ou usuário de fora. */
    sharedWithEmail?: string;
    permissions?: Partial<DocumentSharePermissions>;
    message?: string;
    expiresAt?: string;
  },
): Promise<ShareGrantResult> {
  if (!input.sharedWithUserId?.trim() && !input.sharedWithEmail?.trim()) {
    throw new ServiceError(
      'Informe o destinatário do compartilhamento.',
      'MISSING_SHARED_WITH_USER',
      400,
    );
  }

  if (input.sharedWithUserId?.trim() === user.id) {
    throw new ServiceError('Você não pode compartilhar consigo mesmo.', 'SELF_SHARE_DENIED', 400);
  }

  const { doc, requiresApproval } = await loadShareableDocument(ctx, user, documentId);

  const recipient = await resolveShareRecipient(ctx.tenantId, input);
  const sharedWithUserId = recipient.userId;

  if (sharedWithUserId === user.id) {
    throw new ServiceError('Você não pode compartilhar consigo mesmo.', 'SELF_SHARE_DENIED', 400);
  }

  const permissions = defaultSharePermissions(input.permissions);
  assertSharePermissions(permissions);

  const crossesTenantBorder = recipient.scope === 'external_tenant';
  const expiresAt = resolveShareExpiration(input.expiresAt, crossesTenantBorder);

  /**
   * `share` ganha a segunda dimensão: para dentro e para fora do tenant são riscos diferentes.
   *
   * Dentro de casa a governança decide, como sempre. Para fora, a aprovação é **piso** e não
   * default: o documento sai do alcance de quem o governa, e nenhuma célula do mapa de regras foi
   * escrita com essa saída em mente — tratá-la como um compartilhamento comum deixaria o acervo
   * atravessar a fronteira com a permissão que existia para uso interno.
   *
   * Administrador é a exceção porque ele é quem aprovaria: pedir aprovação a si mesmo trocaria uma
   * decisão por uma formalidade, e o gesto ficaria a dois cliques de distância do mesmo resultado.
   */
  const requiresApprovalToShare =
    requiresApproval || (crossesTenantBorder && !isDocumentAdmin(user));

  /**
   * O pedido nasce depois da validação, e carrega o que precisa para acontecer.
   *
   * Diferente do download: lá aprovar concede licença e quem pediu repete a ação. Aqui aprovar
   * **executa** — o administrador não tem o destinatário, as permissões nem a mensagem em mãos,
   * então eles vão no `payload`. Validar antes é o que impede um pedido que, aprovado, falharia.
   */
  if (requiresApprovalToShare) {
    const gate = await resolveDocumentApproval({
      tenantId: ctx.tenantId,
      membershipId: ctx.membershipId,
      user,
      doc,
      kind: 'document_share',
      target: {
        memberId: sharedWithUserId,
        memberName: recipient.name,
      },
      payload: {
        sharedWithUserId,
        recipientScope: recipient.scope,
        recipientName: recipient.name,
        permissions,
        message: input.message?.trim() || null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
      // Aprovar já compartilhou. Tratar o pedido aprovado como passe deixaria a mesma aprovação
      // valer para um segundo compartilhamento que ninguém viu.
      grantsLicense: false,
    });

    throw new ServiceError(
      gate.state === 'pending'
        ? 'Seu pedido para compartilhar este documento está aguardando aprovação.'
        : 'Compartilhar este documento depende de aprovação. Seu pedido foi enviado ao administrador.',
      'DOCUMENT_APPROVAL_REQUIRED',
      409,
    );
  }

  return persistShareGrant({
    ctx,
    doc,
    sharedByUserId: user.id,
    sharedByName: user.name,
    sharedWithUserId,
    permissions,
    message: input.message,
    expiresAt,
    inbound: crossesTenantBorder
      ? await buildInboundState(ctx, doc, user.name, recipient.name)
      : undefined,
  });
}

/**
 * Executa o compartilhamento que o administrador acabou de aprovar.
 *
 * A aprovação **é** a autorização: não se reconsulta a governança de quem pediu, porque o
 * meio-termo já foi resolvido por uma pessoa. O que continua valendo é o mundo de agora — o
 * documento tem de existir e o destinatário tem de estar ativo —, e a concessão sai no nome de
 * quem pediu, não de quem aprovou: foi ele quem compartilhou.
 */
export async function createShareGrantFromApprovedRequest(
  ctx: DocumentRequestContext,
  request: MongoApprovalRequest,
): Promise<ShareGrantResult> {
  const documentId = request.subject.documentId;
  if (!documentId) {
    throw new ServiceError(
      'Pedido de compartilhamento sem documento.',
      'APPROVAL_PAYLOAD_INVALID',
      422,
    );
  }

  const payload = request.payload as {
    sharedWithUserId?: unknown;
    recipientScope?: unknown;
    recipientName?: unknown;
    permissions?: Partial<DocumentSharePermissions>;
    message?: unknown;
    expiresAt?: unknown;
  };
  const sharedWithUserId =
    typeof payload.sharedWithUserId === 'string' ? payload.sharedWithUserId.trim() : '';

  if (!sharedWithUserId) {
    throw new ServiceError(
      'Pedido de compartilhamento sem destinatário.',
      'APPROVAL_PAYLOAD_INVALID',
      422,
    );
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  /**
   * O destino de fora não é reconferido no diretório.
   *
   * A aprovação **é** a autorização, e ela foi dada sobre um destinatário nomeado no pedido. Voltar
   * ao auth-service aqui gastaria a cota de quem aprova por um dado que já está decidido, e faria
   * uma indisponibilidade do diretório derrubar um compartilhamento já autorizado. O que continua
   * sendo conferido é o mundo de agora do lado de cá: o documento existe, e o membro daqui está
   * ativo.
   */
  const crossesTenantBorder = payload.recipientScope === 'external_tenant';

  if (!crossesTenantBorder) {
    await requireShareRecipient(ctx.tenantId, sharedWithUserId);
  }

  const permissions = defaultSharePermissions(payload.permissions);
  assertSharePermissions(permissions);

  return persistShareGrant({
    ctx,
    doc: doc as MongoDocument,
    sharedByUserId: request.requestedBy.userId,
    sharedByName: request.requestedBy.name,
    sharedWithUserId,
    permissions,
    message: typeof payload.message === 'string' ? payload.message : null,
    expiresAt:
      typeof payload.expiresAt === 'string' && payload.expiresAt
        ? new Date(payload.expiresAt)
        : null,
    inbound: crossesTenantBorder
      ? await buildInboundState(
          ctx,
          doc as MongoDocument,
          request.requestedBy.name,
          typeof payload.recipientName === 'string' ? payload.recipientName : sharedWithUserId,
        )
      : undefined,
  });
}

export async function revokeDocumentShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  shareId: string,
) {
  const collection = await getShareGrantsCollection();
  const grant = await collection.findOne({ _id: shareId, documentId, status: 'active' });

  if (!grant) {
    throw new ServiceError('Compartilhamento não encontrado.', 'SHARE_NOT_FOUND', 404);
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });

  const canRevoke =
    isDocumentAdmin(user) ||
    grant.sharedByUserId === user.id ||
    (doc as MongoDocument).ownerUserId === user.id ||
    canUserShareDocument(user, doc as MongoDocument, memberGroupIds, governanceIndex);

  if (!canRevoke) {
    throw new ServiceError(
      'Você não tem permissão para revogar este compartilhamento.',
      'DOCUMENT_SHARE_REVOKE_DENIED',
      403,
    );
  }

  const now = new Date();
  await collection.updateOne(
    { _id: shareId },
    {
      $set: {
        status: 'revoked',
        revokedAt: now,
        revokedBy: user.id,
        updatedAt: now,
      },
    },
  );

  return {
    shareId,
    documentId,
    sharedWithUserId: grant.sharedWithUserId,
    revokedAt: now.toISOString(),
    currentVersionId: (doc as MongoDocument).currentVersionId,
  };
}

export async function listSharedWithMeDocuments(
  user: AuthUser,
  membershipId?: string,
  search?: string,
) {
  const tenantId = getTenantIdFromUser(user);

  if (!isMongoNativeConfigured()) {
    return { items: [], total: 0 };
  }

  const grants = await findActiveShareGrantsForUser(user.id, tenantId);
  if (!grants.length) {
    return { items: [], total: 0 };
  }

  const grantByDocumentId = new Map(grants.map((grant) => [grant.documentId, grant]));
  const documentIds = [...grantByDocumentId.keys()];

  const { documents, storage } = await getTenantCollections(tenantId, {
    userId: user.id,
    membershipId,
  });

  const docs = (await documents
    .find({
      _id: { $in: documentIds },
      ...tenantScopeFilterFromContext(storage),
      ...ACTIVE_DOCUMENT_FILTER,
    } as Record<string, unknown>)
    .toArray()) as MongoDocument[];

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId,
    userId: user.id,
    membershipId,
  });

  const memberLookup = new Map(
    (await listOperationalTenantMembers(tenantId)).map((member) => {
      const serialized = serializeTenantMember(member);
      return [serialized.userId, serialized.name] as const;
    }),
  );

  const accessibleDocs = docs.filter((doc) =>
    canUserListDocumentWithShare(
      user,
      doc,
      memberGroupIds,
      grantByDocumentId.get(String(doc._id)),
      governanceIndex,
    ),
  );

  let items = await buildDocumentListItems({
    tenantId,
    docs: accessibleDocs,
    user,
    ownerUserId: user.id,
    membershipId,
    memberGroupIds,
    shareGrantsByDocumentId: grantByDocumentId,
  });

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) => {
      const haystack = [item.currentFileName, item.displayName, item.categoryName, item.ownerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const { activeIds } = await lookupFavoriteFlags(
    user.id,
    items.map((item) => item.documentId),
  );
  items = attachFavoriteFlags(items, activeIds);

  items = items.map((item) => {
    const grant = grantByDocumentId.get(item.documentId);
    if (!grant) return item;
    return {
      ...item,
      sharedWithMe: true,
      sharedByUserId: grant.sharedByUserId,
      sharedByNameSnapshot: memberLookup.get(grant.sharedByUserId) ?? grant.sharedByUserId,
      sharedAt: grant.createdAt.toISOString(),
      sharePermissions: grant.permissions,
    };
  });

  return { items, total: items.length };
}

export async function resolveDocumentAccessWithShare(input: {
  user: AuthUser;
  doc: MongoDocument;
  memberGroupIds?: string[];
  sharedWithUserId?: string;
  tenantId?: string;
  membershipId?: string;
  governanceIndex?: GovernanceAccessIndex;
}) {
  const shareGrant = input.sharedWithUserId
    ? await findActiveShareGrantForUser(String(input.doc._id), input.sharedWithUserId)
    : null;

  const accessContext =
    input.memberGroupIds && input.governanceIndex
      ? { memberGroupIds: input.memberGroupIds, governanceIndex: input.governanceIndex }
      : input.tenantId
        ? await loadDocumentAccessContext({
            tenantId: input.tenantId,
            userId: input.user.id,
            membershipId: input.membershipId,
          })
        : {
            memberGroupIds: input.memberGroupIds ?? [],
            governanceIndex: input.governanceIndex,
          };

  const memberGroupIds = accessContext.memberGroupIds ?? [];
  const governanceIndex = accessContext.governanceIndex;

  return {
    shareGrant,
    // Devolvidos para quem precisa decidir mais coisas sobre o mesmo documento — tracking, por
    // exemplo — sem recarregar grupos e regras do banco.
    memberGroupIds,
    governanceIndex,
    permissions: resolveDocumentPermissionsWithShare(
      input.user,
      input.doc,
      memberGroupIds,
      shareGrant,
      governanceIndex,
    ),
    canList: canUserListDocumentWithShare(
      input.user,
      input.doc,
      memberGroupIds,
      shareGrant,
      governanceIndex,
    ),
  };
}
