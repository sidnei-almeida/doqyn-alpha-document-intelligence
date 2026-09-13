import type { CollationOptions, IndexDescription } from 'mongodb';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { TEXT_SORT_COLLATION } from '../utils/textCollation.js';
import { getDb } from '../db/mongoClient.js';
import {
  resolveSharedCollections,
  type ResolvedTenantCollectionNames,
} from '../tenancy/tenantResolver.js';

export type IndexEnsureResult = {
  collection: string;
  name: string;
  status: 'created' | 'existing' | 'dropped' | 'error';
  error?: string;
};

/**
 * O que fazer quando a criação de um índice falha.
 *
 * O provisionamento de tenant deixa a exceção subir: um índice único que não nasceu é um tenant
 * que aceita duplicata, e é melhor a criação falhar do que seguir com a garantia faltando.
 *
 * O job de operação não pode: ele percorre a base inteira, e abortar no primeiro erro deixaria
 * todas as coleções seguintes sem índice por causa de uma. Lá a falha vira linha de relatório.
 */
export type EnsureIndexOptions = { continueOnError?: boolean };

async function ensureCollectionExists(collectionName: string): Promise<boolean> {
  const db = await getDb();
  const exists = await db.listCollections({ name: collectionName }).hasNext();
  if (!exists) {
    await db.createCollection(collectionName);
    return true;
  }
  return false;
}

export async function ensureIndexesForCollection(
  collectionName: string,
  indexes: IndexDescription[],
  options?: EnsureIndexOptions,
): Promise<IndexEnsureResult[]> {
  const continueOnError = options?.continueOnError ?? false;
  const createdCollection = await ensureCollectionExists(collectionName);
  const db = await getDb();
  const collection = db.collection(collectionName);
  const existing = await collection.indexes();
  const results: IndexEnsureResult[] = [];

  if (createdCollection) {
    results.push({ collection: collectionName, name: '_collection_', status: 'created' });
  }

  for (const spec of indexes) {
    const keyStr = JSON.stringify(spec.key);

    /**
     * Índice com o nome declarado, mas com outra chave: a forma mudou e o antigo ficou para trás.
     *
     * Sem isto a criação falha para sempre — o Mongo recusa reaproveitar um nome com chave
     * diferente, e a checagem por forma de chave logo abaixo nunca encontra o novo, então toda
     * rodada do job repete o mesmo erro e o índice novo nunca nasce. Foi o que aconteceu com
     * `inbound_pending_by_recipient`.
     *
     * Derruba só quando a chave difere. Enquanto o nome e a forma batem, nada é mexido — soltar e
     * recriar a cada rodada deixaria a coleção sem índice durante a reconstrução, por nada.
     */
    if (spec.name && spec.name !== '_id_') {
      const sameName = existing.find((idx) => idx.name === spec.name);
      if (sameName && JSON.stringify(sameName.key) !== keyStr) {
        await collection.dropIndex(spec.name);
        const index = existing.indexOf(sameName);
        if (index >= 0) existing.splice(index, 1);
        results.push({ collection: collectionName, name: spec.name, status: 'dropped' });
      }
    }

    // Mesma chave com outra collation é outro índice: a consulta com collation não usa o comum.
    const collationOf = (value: { collation?: { locale?: string } }) =>
      value.collation?.locale ?? 'simple';
    const match = existing.find(
      (idx) => JSON.stringify(idx.key) === keyStr && collationOf(idx) === collationOf(spec),
    );

    if (match) {
      results.push({
        collection: collectionName,
        name: match.name ?? keyStr,
        status: 'existing',
      });
      continue;
    }

    const createOptions: {
      unique?: boolean;
      partialFilterExpression?: Record<string, unknown>;
      name?: string;
      expireAfterSeconds?: number;
      collation?: CollationOptions;
    } = {};
    if (spec.unique) createOptions.unique = true;
    // Como o TTL abaixo: declarada e não repassada, a collation some e o índice nasce comum.
    if (spec.collation) createOptions.collation = spec.collation;
    if (spec.partialFilterExpression)
      createOptions.partialFilterExpression = spec.partialFilterExpression;
    if (spec.name) createOptions.name = spec.name;
    // Sem esta linha o TTL era declarado e descartado: o índice nascia comum, e a coleção que
    // depende dele para não crescer para sempre crescia em silêncio.
    if (spec.expireAfterSeconds !== undefined)
      createOptions.expireAfterSeconds = spec.expireAfterSeconds;

    try {
      const created = await collection.createIndex(spec.key, createOptions);
      results.push({ collection: collectionName, name: created, status: 'created' });
    } catch (error) {
      if (!continueOnError) throw error;
      results.push({
        collection: collectionName,
        name: keyStr,
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return results;
}

export function tenantScopedIndexSpecs(names: ResolvedTenantCollectionNames): Array<{
  collection: string;
  indexes: IndexDescription[];
}> {
  const out: Array<{ collection: string; indexes: IndexDescription[] }> = [];

  if (names.documentCategories) {
    out.push({
      collection: names.documentCategories,
      indexes: [
        { key: { tenantId: 1, active: 1 } },
        { key: { tenantId: 1, slug: 1 }, unique: true },
      ],
    });
  }

  if (names.documentGroups) {
    out.push({
      collection: names.documentGroups,
      indexes: [
        { key: { tenantId: 1, active: 1 } },
        { key: { tenantId: 1, slug: 1 }, unique: true },
      ],
    });
  }

  if (names.documentGroupMembers) {
    out.push({
      collection: names.documentGroupMembers,
      indexes: [
        { key: { tenantId: 1, groupId: 1, active: 1 } },
        { key: { tenantId: 1, membershipId: 1, active: 1 } },
        { key: { tenantId: 1, groupId: 1, membershipId: 1 }, unique: true },
      ],
    });
  }

  if (names.pendingInviteGroups) {
    out.push({
      collection: names.pendingInviteGroups,
      indexes: [
        // A busca do sync, que roda para todo membro que entra.
        { key: { tenantId: 1, emailNormalized: 1 } },
        /**
         * Expira sozinho, e é o que impede uma concessão de acesso que ninguém escolheu.
         *
         * O registro guarda "quando esta pessoa entrar, dê estes grupos". Se o convite for
         * revogado ou simplesmente nunca aceito, ele ficaria guardado para sempre — e a pessoa
         * receberia os grupos ao entrar por qualquer outro caminho, meses depois, por uma
         * decisão que alguém tomou e desfez.
         *
         * Oito dias: um a mais que os sete de `INVITE_TTL_DAYS`, para a margem cair do lado de
         * o convite morrer antes da intenção, nunca o contrário.
         */
        { key: { createdAt: 1 }, expireAfterSeconds: 8 * 24 * 60 * 60 },
      ],
    });
  }

  if (names.documentRules) {
    out.push({
      collection: names.documentRules,
      indexes: [
        { key: { tenantId: 1, groupId: 1, categoryId: 1 }, unique: true },
        { key: { tenantId: 1, active: 1 } },
      ],
    });
  }

  if (names.documentExtractionRules) {
    out.push({
      collection: names.documentExtractionRules,
      indexes: [
        { key: { tenantId: 1, categoryId: 1, active: 1 } },
        { key: { tenantId: 1, categoryId: 1, version: -1 } },
      ],
    });
  }

  out.push(
    {
      collection: names.documents,
      indexes: [
        { key: { tenantId: 1, status: 1, updatedAt: -1 } },
        { key: { tenantId: 1, classId: 1, updatedAt: -1 } },
        { key: { tenantId: 1, ownerUserId: 1, updatedAt: -1 } },
        { key: { tenantId: 1, 'searchMeta.people.nameNormalized': 1 } },
        { key: { tenantId: 1, 'searchMeta.validityDate': 1 } },
        { key: { tenantId: 1, 'searchMeta.dates.kind': 1, 'searchMeta.dates.date': 1 } },
        /* Ordenar a Biblioteca por nome ou categoria. Com `TEXT_SORT_COLLATION`, e só com ela:
           a consulta ordenada por texto leva essa collation, e sem índice que a tenha o filtro
           por `tenantId` deixa de usar índice e a listagem vira varredura. A variante com
           `ownerUserId` atende o filtro "meus documentos" e a pessoa física. */
        { key: { tenantId: 1, currentFileName: 1 }, collation: TEXT_SORT_COLLATION },
        {
          key: { tenantId: 1, ownerUserId: 1, currentFileName: 1 },
          collation: TEXT_SORT_COLLATION,
        },
        { key: { tenantId: 1, className: 1 }, collation: TEXT_SORT_COLLATION },
        { key: { tenantId: 1, ownerUserId: 1, className: 1 }, collation: TEXT_SORT_COLLATION },
      ],
    },
    {
      collection: names.documentVersions,
      indexes: [
        { key: { tenantId: 1, documentId: 1, versionNumber: -1 }, unique: true },
        { key: { tenantId: 1, 'file.sha256': 1 } },
      ],
    },
    {
      collection: names.documentChunks,
      indexes: [
        { key: { tenantId: 1, documentId: 1, versionId: 1, chunkIndex: 1 }, unique: true },
        { key: { tenantId: 1, documentId: 1, isCurrentVersion: 1, chunkIndex: 1 } },
        { key: { tenantId: 1, documentId: 1, versionLabel: 1 } },
        { key: { tenantId: 1, ownerUserId: 1, documentId: 1, isCurrentVersion: 1 } },
      ],
    },
    {
      collection: names.processingJobs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, status: 1 } },
      ],
    },
    {
      collection: names.auditLogs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, documentId: 1, occurredAt: -1 } },
        { key: { tenantId: 1, action: 1, createdAt: -1 } },
        { key: { tenantId: 1, 'actor.userId': 1, createdAt: -1 } },
        // Escopo de pessoa física: um tenant PF tem um único usuário e as consultas dele
        // filtram por tenantId + ownerUserId.
        { key: { tenantId: 1, ownerUserId: 1, createdAt: -1 } },
        { key: { tenantId: 1, createdAt: -1 } },
        { key: { tenantId: 1, requestId: 1 } },
        { key: { tenantId: 1, 'metadata.status': 1, createdAt: -1 } },
        { key: { tenantId: 1, 'metadata.actionGroup': 1, createdAt: -1 } },
        // A verificação da cadeia de integridade percorre o tenant inteiro em ordem de posição;
        // sem este índice ela vira collection scan com sort em memória.
        { key: { tenantId: 1, 'chain.seq': 1 } },
      ],
    },
  );

  return out;
}

/**
 * Antes existia um segundo conjunto de índices liderado por `ownerTenantId`, para o pool de pessoa
 * física. Ele foi removido no Passo 7: `applyDocumentOwnershipOnInsert` grava `ownerTenantId` com
 * o mesmo valor de `tenantId` nos dois tipos de tenant, então, agora que PF e PJ dividem as mesmas
 * coleções, aqueles índices seriam duplicatas exatas — o dobro de namespaces para nada, justo o
 * custo que este passo existe para cortar. As consultas de PF passaram a liderar por `tenantId`
 * (ver `buildDocumentOwnershipFilter`) e usam os índices abaixo.
 */
export async function ensureSharedCollectionIndexes(
  options?: EnsureIndexOptions,
): Promise<IndexEnsureResult[]> {
  return ensureTenantDataIndexes(resolveSharedCollections(), options);
}

export async function ensureTenantDataIndexes(
  names: ResolvedTenantCollectionNames,
  options?: EnsureIndexOptions,
): Promise<IndexEnsureResult[]> {
  const all: IndexEnsureResult[] = [];
  for (const group of tenantScopedIndexSpecs(names)) {
    const results = await ensureIndexesForCollection(group.collection, group.indexes, options);
    all.push(...results);
  }
  return all;
}

/**
 * Os índices do registro — tenants e membros — numa lista só.
 *
 * Moravam em dois lugares: aqui, inline no `ensureRegistryTenantIndexes`, e no
 * `scripts/ensure-mongodb-indexes.ts`. As duas listas divergiram: o script criava três índices a
 * mais em `tenants` e oito em `tenant_members` que o provisionamento nunca criava. Quem provisionou
 * pelo app ficou com menos índice do que quem rodou o job — e ninguém notou, porque índice que
 * falta não dá erro, dá lentidão.
 */
export const REGISTRY_INDEX_SPECS: Array<{ collection: string; indexes: IndexDescription[] }> = [
  {
    collection: REGISTRY_COLLECTIONS.tenants,
    indexes: [
      { key: { tenantId: 1 }, unique: true },
      // Parcial porque o Mongo trata campo ausente como null, e único só aceita um null: sem
      // isto, o segundo tenant sem `taxIdHash` quebra com duplicate-key.
      {
        key: { taxIdHash: 1 },
        unique: true,
        partialFilterExpression: { taxIdHash: { $exists: true } },
      },
      { key: { slug: 1 }, unique: true },
      { key: { status: 1 } },
      // `resolveTenant()` busca com { $or: [{ tenantId }, { companyId }] } em quase toda
      // requisição, e um $or só usa índice se TODOS os ramos forem indexados — sem este, o ramo
      // do companyId força varredura completa do registro a cada request. Parcial porque nem todo
      // tenant tem companyId, e não é único porque os dois campos podem coincidir.
      { key: { companyId: 1 }, partialFilterExpression: { companyId: { $exists: true } } },
      { key: { tenantType: 1, status: 1 } },
      { key: { createdAt: 1 } },
      { key: { updatedAt: 1 } },
    ],
  },
  {
    collection: REGISTRY_COLLECTIONS.tenantMembers,
    indexes: [
      { key: { tenantId: 1, status: 1 } },
      // Um e-mail por tenant, mas só entre quem conta: bloqueado e rejeitado saem do único para
      // que a mesma pessoa possa ser convidada de novo depois.
      {
        key: { tenantId: 1, emailNormalized: 1 },
        unique: true,
        partialFilterExpression: { status: { $in: ['active', 'pending'] } },
      },
      { key: { tenantId: 1, authUserId: 1 } },
      { key: { authUserId: 1, status: 1 } },
      { key: { tenantId: 1, accessGroupIds: 1 } },
      { key: { tenantId: 1, createdAt: 1 } },
      { key: { tenantId: 1, updatedAt: 1 } },
      { key: { memberId: 1 }, unique: true },
    ],
  },
];

export async function ensureRegistryTenantIndexes(
  options?: EnsureIndexOptions,
): Promise<IndexEnsureResult[]> {
  const all: IndexEnsureResult[] = [];
  for (const group of REGISTRY_INDEX_SPECS) {
    all.push(...(await ensureIndexesForCollection(group.collection, group.indexes, options)));
  }
  return all;
}
