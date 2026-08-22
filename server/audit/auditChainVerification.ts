import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { ServiceError } from '../utils/serviceErrors.js';
import {
  AUDIT_CHAIN_GENESIS,
  computeEventHash,
  getChainHead,
  type AuditChainPayload,
} from './auditChain.js';

export type AuditChainBreak = {
  seq: number;
  eventId: string | null;
  occurredAt: string | null;
  /**
   * `hash_mismatch` — o conteúdo do evento mudou depois de gravado.
   * `broken_link` — o elo anterior não confere; alguém apagou ou reordenou.
   * `missing_event` — a posição foi reservada e o evento não está lá.
   * `duplicate_seq` — duas linhas ocupam a mesma posição.
   */
  kind: 'hash_mismatch' | 'broken_link' | 'missing_event' | 'duplicate_seq';
  detail: string;
};

export type AuditChainVerification = {
  ok: boolean;
  tenantId: string;
  /** Eventos que participam da cadeia. */
  verified: number;
  /** Eventos anteriores à adoção da cadeia — ficam fora da verificação, por desenho. */
  unchained: number;
  /** Eventos encadeados mas sem carimbo de versão: o hash deles não é reproduzível. */
  legacy: number;
  expectedSeq: number | null;
  headHash: string | null;
  breaks: AuditChainBreak[];
};

type ChainedRow = {
  _id: string;
  action: string;
  description?: string;
  actor?: { userId?: string };
  documentId?: string | null;
  versionId?: string | null;
  result?: string;
  severity?: string;
  occurredAt?: Date;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  chain?: { seq: number; prevHash: string; hash: string; version?: number };
};

function toPayload(row: ChainedRow, tenantId: string): AuditChainPayload {
  return {
    id: String(row._id),
    tenantId,
    action: String(row.action),
    description: String(row.description ?? ''),
    actorUserId: String(row.actor?.userId ?? ''),
    documentId: row.documentId ?? null,
    versionId: row.versionId ?? null,
    result: String(row.result ?? ''),
    severity: String(row.severity ?? ''),
    occurredAt: row.occurredAt ?? row.createdAt ?? new Date(0),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

/**
 * Recomputa a cadeia do tenant e aponta onde ela quebra.
 *
 * Percorre em ordem de `chain.seq`, refaz o hash de cada evento a partir do anterior e compara com
 * o gravado. Eventos sem carimbo — os que existiam antes da adoção da cadeia — são contados à parte
 * em vez de virarem falso positivo: eles simplesmente não têm o que verificar.
 */
export async function verifyAuditChain(input: {
  tenantId: string;
  ownerUserId?: string;
  membershipId?: string;
  limit?: number;
}): Promise<AuditChainVerification> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const { auditLogs, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
    membershipId: input.membershipId,
  });

  const scope = tenantScopeFilterFromContext(storage);
  const limit = Math.min(Math.max(input.limit ?? 20000, 1), 100000);

  const rows = (await auditLogs
    .find({ ...scope, 'chain.seq': { $exists: true } } as Record<string, unknown>)
    .sort({ 'chain.seq': 1 })
    .limit(limit)
    .toArray()) as unknown as ChainedRow[];

  const unchained = await auditLogs.countDocuments({
    ...scope,
    'chain.seq': { $exists: false },
  } as Record<string, unknown>);

  const breaks: AuditChainBreak[] = [];
  let prevHash = AUDIT_CHAIN_GENESIS;
  let expectedSeq = 1;
  let legacy = 0;

  for (const row of rows) {
    const chain = row.chain!;
    const occurredAt = (row.occurredAt ?? row.createdAt)?.toISOString() ?? null;

    if (chain.seq < expectedSeq) {
      breaks.push({
        seq: chain.seq,
        eventId: String(row._id),
        occurredAt,
        kind: 'duplicate_seq',
        detail: `posição ${chain.seq} aparece mais de uma vez`,
      });
      continue;
    }

    while (chain.seq > expectedSeq) {
      breaks.push({
        seq: expectedSeq,
        eventId: null,
        occurredAt: null,
        kind: 'missing_event',
        detail: `nenhum evento na posição ${expectedSeq}`,
      });
      expectedSeq += 1;
      // A posição vazia interrompe o encadeamento: daqui em diante não há como saber qual era o
      // hash anterior, então seguimos a partir do que o próprio evento declara.
      prevHash = chain.prevHash;
    }

    if (chain.prevHash !== prevHash) {
      breaks.push({
        seq: chain.seq,
        eventId: String(row._id),
        occurredAt,
        kind: 'broken_link',
        detail: 'o elo anterior não confere com o hash do evento que o precede',
      });
    }

    // Cada evento é recomputado com a versão de fórmula que ele próprio declara; sem isso, evoluir
    // a fórmula transformaria toda a trilha anterior em falso positivo.
    //
    // Evento sem carimbo de versão vem de antes desta convenção e não tem fórmula reproduzível: a
    // primeira escrita hasheava o objeto em memória, onde campo ausente era `undefined`, e o driver
    // gravou `null` no lugar dele — o dado necessário para refazer aquele hash não existe mais no
    // banco. A cadeia atravessa esses eventos pelo elo declarado e os conta à parte, porque
    // chamá-los de adulteração seria mentira.
    if (chain.version === undefined) {
      legacy += 1;
    } else {
      const recomputed = computeEventHash(
        toPayload(row, input.tenantId),
        chain.prevHash,
        chain.version,
      );
      if (recomputed !== chain.hash) {
        breaks.push({
          seq: chain.seq,
          eventId: String(row._id),
          occurredAt,
          kind: 'hash_mismatch',
          detail: 'o conteúdo do evento mudou depois de gravado',
        });
      }
    }

    prevHash = chain.hash;
    expectedSeq = chain.seq + 1;
  }

  const head = await getChainHead(input.tenantId);

  // O ponteiro à frente do último evento significa posição reservada sem evento gravado.
  if (head && rows.length > 0 && head.seq > (rows[rows.length - 1]?.chain?.seq ?? 0)) {
    breaks.push({
      seq: head.seq,
      eventId: null,
      occurredAt: null,
      kind: 'missing_event',
      detail: `o ponteiro da cadeia está em ${head.seq}, à frente do último evento gravado`,
    });
  }

  return {
    ok: breaks.length === 0,
    tenantId: input.tenantId,
    verified: rows.length - legacy,
    unchained,
    legacy,
    expectedSeq: rows.length > 0 ? (rows[rows.length - 1]?.chain?.seq ?? null) : null,
    headHash: head?.headHash ?? null,
    breaks,
  };
}
