import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoDocumentRequest, MongoDocumentShareGrant } from '../../db/types.js';
import { resolveTenant } from '../../tenancy/tenantResolver.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';

/**
 * As empresas com quem esta já trocou documentos, e as pessoas de contato em cada uma.
 *
 * Derivado do que já aconteceu, sem coleção nova: as concessões aceitas e os pedidos recebidos já
 * carregam os dois lados. Uma lista mantida à mão envelheceria sozinha e mentiria — esta só existe
 * enquanto houver troca real por trás dela.
 *
 * **Só conta o que foi aceito.** Antes do aceite não há parceria: houve uma oferta, e ela pode ter
 * sido recusada. Listar oferta pendente como "empresa conhecida" transformaria intenção em
 * histórico.
 */
export type PartnerContact = {
  userId: string;
  name: string;
  email?: string;
};

export type PartnerTenant = {
  tenantId: string;
  displayName: string;
  /** Quantas trocas já houve, nas duas direções. */
  exchanges: number;
  lastExchangeAt: string;
  contacts: PartnerContact[];
};

type Accumulator = {
  tenantId: string;
  displayName: string;
  exchanges: number;
  lastExchangeAt: Date;
  contacts: Map<string, PartnerContact>;
};

function touch(
  acc: Map<string, Accumulator>,
  tenantId: string,
  displayName: string,
  when: Date,
  contact?: PartnerContact,
): void {
  if (!tenantId) return;

  const current = acc.get(tenantId) ?? {
    tenantId,
    displayName,
    exchanges: 0,
    lastExchangeAt: when,
    contacts: new Map<string, PartnerContact>(),
  };

  current.exchanges += 1;
  if (when > current.lastExchangeAt) current.lastExchangeAt = when;
  // O nome mais recente vence: empresa que trocou de razão social não fica com a antiga na lista.
  if (displayName) current.displayName = displayName;

  if (contact?.userId) {
    const existing = current.contacts.get(contact.userId);
    // O e-mail é o que serve para escrever de novo, e nem toda origem o tem. Quem tiver, ganha.
    current.contacts.set(contact.userId, {
      userId: contact.userId,
      name: contact.name || existing?.name || contact.userId,
      email: contact.email ?? existing?.email,
    });
  }

  acc.set(tenantId, current);
}

async function resolveTenantName(tenantId: string, fallback: string): Promise<string> {
  try {
    const tenant = await resolveTenant(tenantId);
    return tenant.displayName || fallback || tenantId;
  } catch {
    // Empresa apagada ou fora do alcance: o nome copiado na troca ainda serve para identificá-la.
    return fallback || tenantId;
  }
}

export async function listPartnerTenants(tenantId: string): Promise<PartnerTenant[]> {
  if (!isMongoNativeConfigured()) return [];

  const db = await getDb();
  const acc = new Map<string, Accumulator>();

  const grants = await db
    .collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants)
    .find({
      'inbound.status': 'accepted',
      $or: [{ tenantId }, { 'inbound.recipientTenantId': tenantId }],
    } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  for (const grant of grants) {
    if (!grant.inbound) continue;
    const when = grant.inbound.decidedAt ?? grant.createdAt;

    if (grant.tenantId === tenantId) {
      // Nós enviamos: a outra empresa é a de quem aceitou, e o nome dela só se soube no aceite.
      const partnerId = grant.inbound.recipientTenantId;
      touch(acc, partnerId, await resolveTenantName(partnerId, ''), when, {
        userId: grant.sharedWithUserId,
        name: grant.inbound.offer.recipientName,
        email: grant.inbound.offer.recipientEmail,
      });
    } else {
      // Nós recebemos: a outra empresa é a de origem, e o nome veio junto da oferta.
      touch(acc, grant.tenantId, grant.inbound.offer.originTenantName, when, {
        userId: grant.sharedByUserId,
        name: grant.inbound.offer.sharedByName,
        email: grant.inbound.offer.sharedByEmail,
      });
    }
  }

  /**
   * Pedidos que **nos** foram feitos de fora, e só eles.
   *
   * O recorte é por quem recebeu: `document_requests` é coleção compartilhada, e filtrar apenas
   * por "veio de outro tenant" devolveria os pedidos que empresas alheias fizeram entre si — a
   * rede de parceiros dos outros, entregue de graça a quem abrisse a tela.
   */
  const memberUserIds = (await listOperationalTenantMembers(tenantId))
    .map((member) => member.authUserId ?? member.memberId)
    .filter((id): id is string => Boolean(id));

  const requests = memberUserIds.length
    ? await db
        .collection<MongoDocumentRequest>(SHARED_APP_COLLECTIONS.documentRequests)
        .find({
          crossTenant: { $exists: true },
          tenantId: { $ne: tenantId },
          'requestedFrom.userId': { $in: memberUserIds },
        } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray()
    : [];

  for (const request of requests) {
    // Pedidos que **nos** foram feitos de fora: quem pediu é o contato, e a empresa veio no pedido.
    if (!request.crossTenant) continue;
    touch(acc, request.tenantId, request.crossTenant.requesterTenantName, request.createdAt, {
      userId: request.requestedBy.userId,
      name: request.requestedBy.name,
      email: request.requestedBy.email,
    });
  }

  return [...acc.values()]
    .sort((a, b) => b.lastExchangeAt.getTime() - a.lastExchangeAt.getTime())
    .map((entry) => ({
      tenantId: entry.tenantId,
      displayName: entry.displayName,
      exchanges: entry.exchanges,
      lastExchangeAt: entry.lastExchangeAt.toISOString(),
      contacts: [...entry.contacts.values()],
    }));
}
