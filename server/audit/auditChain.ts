import { createHash } from 'node:crypto';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import { logger } from '../utils/logger.js';

/**
 * Cadeia de integridade da trilha de auditoria.
 *
 * Cada evento carrega `chain.hash = sha256(payload canônico + hash do evento anterior)`. Alterar,
 * apagar ou reordenar uma linha no Mongo quebra a cadeia dali em diante, e a verificação aponta
 * exatamente onde — que é o que uma auditoria externa pede: não "confie no banco", e sim "prove".
 *
 * O que a cadeia **não** faz: impedir a adulteração. Quem tem acesso de escrita ao Mongo pode
 * reescrever um evento; o que ele não consegue é fazer isso sem deixar rastro, a menos que
 * recalcule toda a cadeia a partir dali — e mesmo assim o `headHash` guardado em outra coleção
 * ficaria divergente.
 */
export const AUDIT_CHAIN_ALGO = 'sha256';

/** Ancora o primeiro evento de cada tenant. Só precisa ser estável, não secreto. */
export const AUDIT_CHAIN_GENESIS = 'doqyn-audit-chain-genesis-v1';

export type AuditChainStamp = {
  algo: typeof AUDIT_CHAIN_ALGO;
  version: number;
  seq: number;
  prevHash: string;
  hash: string;
};

export type AuditChainHead = {
  _id: string;
  seq: number;
  headHash: string;
  updatedAt: Date;
};

/**
 * Versão da fórmula do hash. Fica gravada em cada evento para que uma mudança de fórmula não
 * invalide retroativamente a cadeia já escrita — a verificação recomputa cada evento com a versão
 * que ele declara.
 */
export const AUDIT_CHAIN_VERSION = 3;

/**
 * Serialização determinística: chaves ordenadas em qualquer profundidade e datas em ISO.
 *
 * `JSON.stringify` comum não serve — a ordem das chaves segue a ordem de inserção do objeto, então
 * o mesmo evento produziria hashes diferentes conforme o caminho de código que o montou, e a
 * verificação acusaria adulteração onde não houve.
 *
 * Ausência e nulo são tratados como a mesma coisa (`version 2`). O driver do Mongo grava `undefined`
 * como `null`, então um `country: undefined` no momento da escrita volta da leitura como
 * `country: null`; distinguir os dois fazia todo evento com `securityContext` — que é cheio de campo
 * opcional — acusar adulteração sem que nada tivesse mudado. Alterar um valor real para nulo
 * continua sendo detectado, porque o valor anterior participava do hash.
 */
export function canonicalize(value: unknown, version = AUDIT_CHAIN_VERSION): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, version)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => (version >= 2 ? item !== undefined && item !== null : item !== undefined))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item, version)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

/** Campos que entram no hash. Mudar esta lista invalida as cadeias já gravadas. */
export type AuditChainPayload = {
  id: string;
  tenantId: string;
  action: string;
  /** Entrou na versão 3: sem ela, reescrever o texto que o auditor lê não quebrava a cadeia. */
  description: string;
  actorUserId: string;
  documentId: string | null;
  versionId: string | null;
  result: string;
  severity: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
};

export function computeEventHash(
  payload: AuditChainPayload,
  prevHash: string,
  version = AUDIT_CHAIN_VERSION,
): string {
  // A versão 2 não conhecia `description`; recomputar um evento antigo com ela no payload daria
  // hash diferente e acusaria adulteração inexistente.
  const scoped = version >= 3 ? payload : { ...payload, description: undefined };

  return createHash(AUDIT_CHAIN_ALGO)
    .update(`${prevHash}\n${canonicalize(scoped, version)}`)
    .digest('hex');
}

async function getChainHeadsCollection() {
  const db = await getDb();
  return db.collection<AuditChainHead>(SHARED_APP_COLLECTIONS.auditChainHeads);
}

/**
 * Reserva a próxima posição da cadeia do tenant e devolve o carimbo do evento.
 *
 * O avanço do ponteiro é um compare-and-swap sobre `seq`: dois processos escrevendo ao mesmo tempo
 * (API e worker, por exemplo) leem o mesmo head, mas só um consegue gravar `seq + 1`; o outro
 * recomeça com o head já atualizado. Sem isso, os dois encadeariam a partir do mesmo `prevHash` e a
 * cadeia nasceria bifurcada.
 */
export async function reserveChainSlot(
  tenantId: string,
  payload: Omit<AuditChainPayload, 'tenantId'>,
  attempts = 5,
): Promise<AuditChainStamp | null> {
  const heads = await getChainHeadsCollection();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const head = await heads.findOne({ _id: tenantId });
    const prevSeq = head?.seq ?? 0;
    const prevHash = head?.headHash ?? AUDIT_CHAIN_GENESIS;
    const seq = prevSeq + 1;
    const hash = computeEventHash({ ...payload, tenantId }, prevHash);
    const now = new Date();

    if (!head) {
      try {
        await heads.insertOne({ _id: tenantId, seq, headHash: hash, updatedAt: now });
        return { algo: AUDIT_CHAIN_ALGO, version: AUDIT_CHAIN_VERSION, seq, prevHash, hash };
      } catch {
        // Outro processo criou o head primeiro; recomeça lendo o valor dele.
        continue;
      }
    }

    const updated = await heads.updateOne(
      { _id: tenantId, seq: prevSeq },
      { $set: { seq, headHash: hash, updatedAt: now } },
    );

    if (updated.modifiedCount === 1) {
      return { algo: AUDIT_CHAIN_ALGO, version: AUDIT_CHAIN_VERSION, seq, prevHash, hash };
    }
  }

  logger.warn('audit chain slot reservation exhausted attempts', { tenantId, attempts });
  return null;
}

/**
 * Devolve o ponteiro ao estado anterior quando a inserção do evento falha.
 *
 * Best-effort e condicionado ao `seq` reservado: se outro processo já avançou a cadeia, não há o
 * que desfazer sem apagar o trabalho dele, e a verificação acusaria o buraco de qualquer forma.
 */
export async function rollbackChainSlot(
  tenantId: string,
  stamp: AuditChainStamp,
): Promise<void> {
  try {
    const heads = await getChainHeadsCollection();
    await heads.updateOne(
      { _id: tenantId, seq: stamp.seq, headHash: stamp.hash },
      { $set: { seq: stamp.seq - 1, headHash: stamp.prevHash, updatedAt: new Date() } },
    );
  } catch (error) {
    logger.warn('audit chain rollback failed', {
      tenantId,
      seq: stamp.seq,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function getChainHead(tenantId: string): Promise<AuditChainHead | null> {
  const heads = await getChainHeadsCollection();
  return heads.findOne({ _id: tenantId });
}
