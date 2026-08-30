import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  MongoDocumentRequest,
  MongoDocumentShareGrant,
  MongoDocumentSignatureRequest,
} from '../../db/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import type { AuthUser } from '../../auth/types.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';

/**
 * Com quem esta pessoa realmente troca documento, e em que ordem oferecê-los.
 *
 * Derivado do que já aconteceu, sem coleção nova e sem escrita em caminho quente — o mesmo desenho
 * de `partnerTenantsService`, um andar abaixo: lá a unidade é a empresa, aqui é a pessoa.
 *
 * **Não é agenda, e não existe botão de adicionar.** Uma lista mantida à mão envelhece sozinha:
 * quem mudou de time ou saiu da empresa continuaria sendo oferecido, e quase ninguém curaria a
 * lista para começo de conversa. Uma lista derivada não tem como mentir.
 *
 * **A ordem é sempre do próprio usuário.** Nunca há ranking global: "as pessoas mais acionadas da
 * plataforma" seria popularidade entregue a qualquer um que abrisse a tela, e é exatamente o sinal
 * que uma varredura de diretório procura.
 */

/**
 * Frequência com decaimento, e não uma coisa ou outra.
 *
 * Só frequência congela o topo — quem foi muito acionado no ano passado fica lá para sempre. Só
 * recência oscila — um envio avulso empurra o time de todo dia para baixo. Com meia-vida de 30
 * dias, uma interação de hoje vale 1, a de um mês vale 0,5, a de dois meses 0,25: três
 * acionamentos desta semana passam na frente de trinta do ano passado.
 */
const HALF_LIFE_DAYS = 30;

/** Mais velho que isto não muda ordem nenhuma: vale menos de 1,6% de uma interação de hoje. */
const WINDOW_DAYS = 180;

/** Teto por coleção, como `listPartnerTenants` já faz — a lista é atalho, não relatório. */
const SCAN_LIMIT = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ContactAffinity = {
  userId: string;
  name: string;
  email?: string;
  /**
   * O handle público — hoje **sempre ausente**, e o campo existe para quando deixar de ser.
   *
   * Não há de onde tirá-lo sem custo. `MongoTenantMember.username` parece a fonte e não é: é
   * campo legado que guarda o e-mail (`tenantMemberSyncService.ts` grava `username: email`), e
   * exibi-lo mostraria `@fulano@empresa.com` embaixo do próprio endereço. A cópia feita no envio
   * entre empresas guarda nome e e-mail, nunca o apelido. Buscá-lo no auth-service exigiria uma
   * rota de handles por lote, que não existe.
   *
   * Mostrar apelido errado é pior que não mostrar nenhum: ele é a identidade pela qual as pessoas
   * se procuram, e um handle inventado manda procurar por quem não existe.
   */
  username?: string;
  /** Soma das interações com decaimento. Só serve para ordenar; não é para exibir. */
  score: number;
  interactions: number;
  lastInteractionAt: string;
  /** `external` é quem está fora da empresa — o caminho de envio dele é outro. */
  scope: 'internal' | 'external';
};

type Accumulator = {
  userId: string;
  name: string;
  email?: string;
  username?: string;
  score: number;
  interactions: number;
  lastInteractionAt: Date;
  scope: 'internal' | 'external';
};

/** Exportada para o teste: é a regra inteira de ordenação, e ela precisa de prova própria. */
export function decayedWeight(when: Date, now: number): number {
  const ageDays = Math.max(0, (now - when.getTime()) / DAY_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

function touch(
  acc: Map<string, Accumulator>,
  now: number,
  input: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    username?: string | null;
    when?: Date | null;
    scope: 'internal' | 'external';
  },
): void {
  const userId = input.userId?.trim();
  const when = input.when;
  if (!userId || !when) return;

  const current = acc.get(userId) ?? {
    userId,
    name: '',
    email: undefined,
    username: undefined,
    score: 0,
    interactions: 0,
    lastInteractionAt: when,
    scope: input.scope,
  };

  current.score += decayedWeight(when, now);
  current.interactions += 1;
  if (when > current.lastInteractionAt) current.lastInteractionAt = when;

  // O rótulo mais recente vence, e o que tem e-mail vence o que não tem: nem toda origem carrega
  // os dois, e é o e-mail que permite escrever de novo.
  if (input.name) current.name = input.name;
  if (input.email) current.email = input.email;
  if (input.username) current.username = input.username;

  acc.set(userId, current);
}

/**
 * Quem esta pessoa aciona, do mais para o menos.
 *
 * Cada consulta abaixo casa com um índice existente. A única que não cabia sem varredura ficou de
 * fora, e está anotada em `listFrequentContacts` — preferir uma lacuna declarada a um COLLSCAN que
 * cresce com o acervo de todos os tenants.
 */
export async function listFrequentContacts(
  ctx: DocumentRequestContext,
  user: AuthUser,
  options?: { scope?: 'internal' | 'external' | 'all'; limit?: number },
): Promise<ContactAffinity[]> {
  if (!isMongoNativeConfigured()) return [];

  const db = await getDb();
  const now = Date.now();
  const since = new Date(now - WINDOW_DAYS * DAY_MS);
  const acc = new Map<string, Accumulator>();

  const members = (await listOperationalTenantMembers(ctx.tenantId)).map(serializeTenantMember);
  const byUserId = new Map(members.filter((member) => member.userId).map((m) => [m.userId, m]));

  const grants = db.collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants);

  /**
   * Compartilhamento de dentro de casa, nas duas direções.
   *
   * Duas consultas em vez de um `$or`: cada direção tem o próprio índice
   * (`sharedByUserId`/`sharedWithUserId` + `status` + `createdAt`), e um `$or` sobre campos
   * distintos abre mão dessa precisão sem ganhar nada.
   *
   * `inbound` ausente é o que significa "de casa" — ver `MongoDocumentShareGrant`.
   */
  const [sentInHouse, receivedInHouse] = await Promise.all([
    grants
      .find({
        sharedByUserId: user.id,
        tenantId: ctx.tenantId,
        inbound: { $exists: false },
        createdAt: { $gte: since },
      } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(SCAN_LIMIT)
      .toArray(),
    grants
      .find({
        sharedWithUserId: user.id,
        tenantId: ctx.tenantId,
        inbound: { $exists: false },
        createdAt: { $gte: since },
      } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(SCAN_LIMIT)
      .toArray(),
  ]);

  for (const grant of sentInHouse) {
    const member = byUserId.get(grant.sharedWithUserId);
    touch(acc, now, {
      userId: grant.sharedWithUserId,
      name: member?.name,
      email: member?.email,
      when: grant.createdAt,
      scope: 'internal',
    });
  }

  for (const grant of receivedInHouse) {
    const member = byUserId.get(grant.sharedByUserId);
    touch(acc, now, {
      userId: grant.sharedByUserId,
      name: member?.name,
      email: member?.email,
      when: grant.createdAt,
      scope: 'internal',
    });
  }

  /**
   * Troca com outra empresa, e **só o que foi aceito**.
   *
   * Antes do aceite houve uma oferta, que pode ter sido recusada. Pontuar oferta pendente
   * transformaria intenção em histórico — a mesma regra que `listPartnerTenants` aplica.
   *
   * Nome e e-mail saem da cópia feita no envio (`inbound.offer`): nenhum dos dois lados alcança o
   * cadastro do outro, e buscá-los aqui seria uma chamada de rede por linha.
   */
  const crossTenant = await grants
    .find({
      'inbound.status': 'accepted',
      $or: [{ sharedByUserId: user.id }, { sharedWithUserId: user.id }],
      createdAt: { $gte: since },
    } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .limit(SCAN_LIMIT)
    .toArray();

  for (const grant of crossTenant) {
    if (!grant.inbound) continue;
    const when = grant.inbound.decidedAt ?? grant.createdAt;

    if (grant.sharedByUserId === user.id) {
      touch(acc, now, {
        userId: grant.sharedWithUserId,
        name: grant.inbound.offer.recipientName,
        email: grant.inbound.offer.recipientEmail,
        when,
        scope: 'external',
      });
    } else {
      touch(acc, now, {
        userId: grant.sharedByUserId,
        name: grant.inbound.offer.sharedByName,
        email: grant.inbound.offer.sharedByEmail,
        when,
        scope: 'external',
      });
    }
  }

  const signatureRequests = db.collection<MongoDocumentSignatureRequest>(
    SHARED_APP_COLLECTIONS.documentSignatureRequests,
  );

  const [signaturesAsked, signaturesSigned] = await Promise.all([
    signatureRequests
      .find({ requestedByUserId: user.id, createdAt: { $gte: since } } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(SCAN_LIMIT)
      .toArray(),
    signatureRequests
      .find({ 'signers.userId': user.id, createdAt: { $gte: since } } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(SCAN_LIMIT)
      .toArray(),
  ]);

  for (const request of signaturesAsked) {
    for (const signer of request.signers) {
      // Signatário sem `userId` é convidado por link: não tem conta, então não há contato a
      // guardar — o caminho dele continua sendo o link com token.
      if (!signer.userId || signer.userId === user.id) continue;
      touch(acc, now, {
        userId: signer.userId,
        name: signer.name,
        email: signer.email,
        when: request.createdAt,
        scope: signer.tenantId && signer.tenantId !== ctx.tenantId ? 'external' : 'internal',
      });
    }
  }

  for (const request of signaturesSigned) {
    if (request.requestedByUserId === user.id) continue;
    touch(acc, now, {
      userId: request.requestedByUserId,
      // O snapshot não guarda e-mail de quem pediu. Sem ele a linha ainda ordena e ainda mostra
      // nome; o que ela não faz é prometer um caminho de escrita que não tem.
      name: request.requestedByNameSnapshot ?? byUserId.get(request.requestedByUserId)?.name,
      email: byUserId.get(request.requestedByUserId)?.email,
      when: request.createdAt,
      scope: byUserId.has(request.requestedByUserId) ? 'internal' : 'external',
    });
  }

  /**
   * Pedidos de documento, nas duas direções que o índice alcança.
   *
   * Ambos os índices de `document_requests` começam por `tenantId`, então as duas consultas abaixo
   * são as que cabem sem varredura. **Fica de fora o pedido que veio de outra empresa**: ele é
   * gravado sob o `tenantId` de quem pediu, e alcançá-lo exigiria consultar sem o prefixo do
   * índice — uma varredura que cresce com o acervo de todos os tenants, para um sinal que o
   * compartilhamento aceito quase sempre já registrou. Fechar essa lacuna é acrescentar um índice
   * por `requestedFrom.userId` sozinho.
   */
  const documentRequests = db.collection<MongoDocumentRequest>(
    SHARED_APP_COLLECTIONS.documentRequests,
  );

  const [requestsMade, requestsReceived] = await Promise.all([
    documentRequests
      .find({
        tenantId: ctx.tenantId,
        'requestedBy.userId': user.id,
        createdAt: { $gte: since },
      } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(SCAN_LIMIT)
      .toArray(),
    documentRequests
      .find({
        tenantId: ctx.tenantId,
        'requestedFrom.userId': user.id,
        createdAt: { $gte: since },
      } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(SCAN_LIMIT)
      .toArray(),
  ]);

  for (const request of requestsMade) {
    touch(acc, now, {
      userId: request.requestedFrom.userId,
      name: request.requestedFrom.name,
      email: request.requestedFrom.email,
      when: request.createdAt,
      scope: byUserId.has(request.requestedFrom.userId) ? 'internal' : 'external',
    });
  }

  for (const request of requestsReceived) {
    touch(acc, now, {
      userId: request.requestedBy.userId,
      name: request.requestedBy.name,
      email: request.requestedBy.email,
      when: request.createdAt,
      scope: byUserId.has(request.requestedBy.userId) ? 'internal' : 'external',
    });
  }

  const scope = options?.scope ?? 'all';
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);

  return (
    [...acc.values()]
      .filter((entry) => entry.userId !== user.id)
      .filter((entry) => scope === 'all' || entry.scope === scope)
      .map((entry) => ({
        ...entry,
        // Quem só apareceu por um caminho sem nome ainda precisa de rótulo: o id cru é feio, mas é
        // honesto, e some assim que qualquer origem trouxer o nome.
        name: entry.name || entry.email || entry.userId,
      }))
      // Empate desempata pela interação mais recente: com dois scores iguais, ganha quem foi
      // acionado por último.
      .sort((a, b) =>
        b.score === a.score
          ? b.lastInteractionAt.getTime() - a.lastInteractionAt.getTime()
          : b.score - a.score,
      )
      .slice(0, limit)
      .map((entry) => ({
        userId: entry.userId,
        name: entry.name,
        email: entry.email,
        username: entry.username,
        score: entry.score,
        interactions: entry.interactions,
        lastInteractionAt: entry.lastInteractionAt.toISOString(),
        scope: entry.scope,
      }))
  );
}
