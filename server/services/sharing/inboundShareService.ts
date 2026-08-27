import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoDocumentShareGrant, InboundShareStatus } from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { notifyInboundShareDecided } from '../notifications/inboundShareNotifications.js';

async function getCollection(): Promise<Collection<MongoDocumentShareGrant>> {
  const db = await getDb();
  return db.collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants);
}

function assertMongo(): void {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }
}

export type InboundShareItem = {
  grantId: string;
  documentId: string;
  documentName: string;
  sharedByName: string;
  originTenantName: string;
  permissions: MongoDocumentShareGrant['permissions'];
  message?: string | null;
  expiresAt?: string | null;
  receivedAt: string;
};

function serialize(grant: MongoDocumentShareGrant): InboundShareItem {
  const offer = grant.inbound!.offer;

  return {
    grantId: grant._id,
    documentId: grant.documentId,
    documentName: offer.documentName,
    sharedByName: offer.sharedByName,
    originTenantName: offer.originTenantName,
    permissions: grant.permissions,
    message: grant.message ?? null,
    expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
    receivedAt: grant.createdAt.toISOString(),
  };
}

/**
 * O que está esperando decisão de quem recebe.
 *
 * Filtra por `recipientTenantId` **e** por `sharedWithUserId`: o aceite é da pessoa, não do
 * administrador dela. Um admin que visse a caixa de outro membro poderia liberar no lugar dele o
 * documento que só ele foi convidado a ver.
 */
export async function listInboundShares(
  tenantId: string,
  user: AuthUser,
): Promise<InboundShareItem[]> {
  assertMongo();

  const collection = await getCollection();
  const grants = await collection
    .find({
      sharedWithUserId: user.id,
      status: 'active',
      'inbound.status': 'pending',
      'inbound.recipientTenantId': tenantId,
    } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();

  return grants.map(serialize);
}

async function decide(
  tenantId: string,
  user: AuthUser,
  grantId: string,
  status: Extract<InboundShareStatus, 'accepted' | 'declined'>,
): Promise<MongoDocumentShareGrant> {
  assertMongo();

  const collection = await getCollection();
  const now = new Date();

  /**
   * A decisão é condicionada a `pending` no próprio update.
   *
   * Dois cliques seguidos — ou duas abas — não podem virar duas decisões, e a segunda não pode
   * sobrescrever a primeira. Quem perde a corrida recebe 409, não uma decisão trocada em silêncio.
   */
  const updated = await collection.findOneAndUpdate(
    {
      _id: grantId,
      sharedWithUserId: user.id,
      'inbound.status': 'pending',
      'inbound.recipientTenantId': tenantId,
    } as Record<string, unknown>,
    { $set: { 'inbound.status': status, 'inbound.decidedAt': now, updatedAt: now } },
    { returnDocument: 'after' },
  );

  if (!updated) {
    const exists = await collection.findOne({ _id: grantId } as Record<string, unknown>);

    if (!exists || exists.sharedWithUserId !== user.id) {
      // Quem não é o destinatário não descobre por aqui que a concessão existe.
      throw new ServiceError('Item não encontrado.', 'INBOUND_SHARE_NOT_FOUND', 404);
    }

    throw new ServiceError('Este item já foi decidido.', 'INBOUND_SHARE_SETTLED', 409);
  }

  return updated;
}

/**
 * Aceitar é o que torna a concessão real.
 *
 * O documento **não** é copiado: ele continua no tenant de origem e o aceite concede leitura. Sem
 * isso, revogar de um lado não fecharia o acesso do outro, e o acervo de quem recebe passaria a
 * conter documento que ele não governa.
 */
export async function acceptInboundShare(
  tenantId: string,
  user: AuthUser,
  grantId: string,
  recipientName: string,
): Promise<InboundShareItem> {
  const grant = await decide(tenantId, user, grantId, 'accepted');
  await notifyInboundShareDecided(grant, 'accepted', recipientName);
  return serialize(grant);
}

/** Recusar não pede motivo. Quem enviou é avisado; o que ele recebe é a decisão, não uma defesa. */
export async function declineInboundShare(
  tenantId: string,
  user: AuthUser,
  grantId: string,
  recipientName: string,
): Promise<InboundShareItem> {
  const grant = await decide(tenantId, user, grantId, 'declined');
  await notifyInboundShareDecided(grant, 'declined', recipientName);
  return serialize(grant);
}
