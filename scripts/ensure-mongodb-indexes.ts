import 'dotenv/config';
import { join } from 'node:path';
import type { IndexDescription } from 'mongodb';
import { REGISTRY_COLLECTIONS, SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import type { ResolvedTenantCollectionNames } from '../server/tenancy/tenantResolver.js';
import { resolveSharedCollections } from '../server/tenancy/tenantStorage.js';
import {
  NOTIFICATION_DELIVERY_INDEXES,
  NOTIFICATION_INDEXES,
} from '../server/db/notificationIndexes.js';
import { ANALYSIS_JOB_INDEXES } from '../server/db/analysisJobIndexes.js';
import {
  APPROVAL_REQUEST_INDEXES,
  SUPERSEDED_APPROVAL_REQUEST_INDEXES,
} from '../server/db/approvalRequestIndexes.js';
import { DOCUMENT_REQUEST_INDEXES } from '../server/db/documentRequestIndexes.js';
import { DOCUMENT_SHARE_GRANTS_INDEXES } from '../server/db/documentShareGrantsIndexes.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_INDICES_MONGODB.txt');

type IndexResult = {
  collection: string;
  name: string;
  status: 'created' | 'existing' | 'dropped' | 'error';
  error?: string;
};

const results: IndexResult[] = [];

async function ensureCollectionExists(collectionName: string) {
  const db = await getDb();
  const exists = await db.listCollections({ name: collectionName }).hasNext();
  if (!exists) {
    await db.createCollection(collectionName);
  }
}

async function ensureIndexes(collectionName: string, indexes: IndexDescription[]) {
  await ensureCollectionExists(collectionName);
  const db = await getDb();
  const collection = db.collection(collectionName);
  const existing = await collection.indexes();

  for (const spec of indexes) {
    const keyStr = JSON.stringify(spec.key);

    // Espelha server/db/tenantIndexes.ts: nome declarado com outra chave é forma antiga que ficou
    // para trás, e o Mongo recusa reaproveitar o nome — sem derrubar, toda rodada repete o mesmo
    // erro e o índice novo nunca nasce.
    if (spec.name && spec.name !== '_id_') {
      const sameName = existing.find((idx) => idx.name === spec.name);
      if (sameName && JSON.stringify(sameName.key) !== keyStr) {
        await collection.dropIndex(spec.name);
        const index = existing.indexOf(sameName);
        if (index >= 0) existing.splice(index, 1);
        results.push({ collection: collectionName, name: spec.name, status: 'dropped' });
      }
    }

    const already = existing.some((idx) => JSON.stringify(idx.key) === keyStr);

    if (already) {
      const name = existing.find((idx) => JSON.stringify(idx.key) === keyStr)?.name ?? keyStr;
      results.push({ collection: collectionName, name, status: 'existing' });
      continue;
    }

    try {
      const options: {
        unique?: boolean;
        partialFilterExpression?: Record<string, unknown>;
        name?: string;
        expireAfterSeconds?: number;
      } = {};
      if (spec.unique) options.unique = true;
      if (spec.partialFilterExpression)
        options.partialFilterExpression = spec.partialFilterExpression;
      if (spec.name) options.name = spec.name;
      // Espelha server/db/tenantIndexes.ts: sem esta linha o TTL era declarado e descartado, e
      // o índice nascia comum.
      if (spec.expireAfterSeconds !== undefined)
        options.expireAfterSeconds = spec.expireAfterSeconds;

      const created = await collection.createIndex(spec.key, options);
      results.push({ collection: collectionName, name: created, status: 'created' });
    } catch (error) {
      results.push({
        collection: collectionName,
        name: keyStr,
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

function registryIndexes(): Array<{ collection: string; indexes: IndexDescription[] }> {
  return [
    {
      collection: REGISTRY_COLLECTIONS.tenants,
      indexes: [
        { key: { tenantId: 1 }, unique: true },
        // Parcial: sem isso, o segundo tenant sem taxIdHash quebra com duplicate-key
        // (Mongo trata campo ausente como null e único só aceita um null).
        // Espelha server/db/tenantIndexes.ts:ensureRegistryTenantIndexes.
        {
          key: { taxIdHash: 1 },
          unique: true,
          partialFilterExpression: { taxIdHash: { $exists: true } },
        },
        { key: { slug: 1 }, unique: true },
        { key: { status: 1 } },
        // resolveTenant() faz { $or: [{ tenantId }, { companyId }] } em quase toda
        // requisição, e $or só usa índice se todos os ramos forem indexados.
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
}

function sharedAppIndexes(): Array<{ collection: string; indexes: IndexDescription[] }> {
  return [
    {
      // Mesma definição canônica que o `setupMongo` aplica — a lista morava só aqui, e quem subia
      // pelo outro caminho ficava sem índice nenhum nesta coleção.
      collection: SHARED_APP_COLLECTIONS.analysisJobs,
      indexes: ANALYSIS_JOB_INDEXES,
    },
    {
      // Importado da definição canônica em vez de recopiado: este script mantém uma segunda lista
      // de índices, e foi justamente a divergência entre as duas que já causou problema antes.
      collection: SHARED_APP_COLLECTIONS.notifications,
      indexes: NOTIFICATION_INDEXES,
    },
    {
      collection: SHARED_APP_COLLECTIONS.notificationDeliveries,
      indexes: NOTIFICATION_DELIVERY_INDEXES,
    },
    {
      // Este script é o que o job do Compose executa — `setupMongo` não é chamado por ninguém em
      // produção. Ficar só lá deixaria `approval_requests` sem índice nenhum no VPS, inclusive sem
      // o único que impede pedido duplicado.
      collection: SHARED_APP_COLLECTIONS.approvalRequests,
      indexes: APPROVAL_REQUEST_INDEXES,
    },
    {
      // Mesma razão de `approval_requests`: este script é o que o Compose executa, e ficar só em
      // `setupMongo` deixaria a coleção sem índice nenhum em produção.
      collection: SHARED_APP_COLLECTIONS.documentRequests,
      indexes: DOCUMENT_REQUEST_INDEXES,
    },
    {
      // A terceira coleção com o mesmo problema, e a mais séria delas: sem estes índices em
      // produção, `document_share_grants` perde o único que impede duas concessões ativas para o
      // mesmo par documento/pessoa — e toda leitura de "Compartilhados comigo" vira varredura.
      collection: SHARED_APP_COLLECTIONS.documentShareGrants,
      indexes: DOCUMENT_SHARE_GRANTS_INDEXES,
    },
  ];
}

function tenantScopedIndexes(names: ResolvedTenantCollectionNames): Array<{
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
      // Espelha server/db/tenantIndexes.ts. O TTL de oito dias é o que impede uma concessão de
      // acesso que ninguém escolheu: convite revogado ou nunca aceito não pode conceder grupo
      // meses depois, por outro caminho de entrada.
      indexes: [
        { key: { tenantId: 1, emailNormalized: 1 } },
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
        { key: { tenantId: 1, currentVersionId: 1 } },
        { key: { 'access.viewGroupIds': 1, tenantId: 1, updatedAt: -1 } },
        { key: { tenantId: 1, createdAt: -1 } },
        { key: { tenantId: 1, ownerUserId: 1, updatedAt: -1 } },
        { key: { tenantId: 1, 'searchMeta.people.nameNormalized': 1 } },
        { key: { tenantId: 1, 'searchMeta.validityDate': 1 } },
        { key: { tenantId: 1, 'searchMeta.dates.kind': 1, 'searchMeta.dates.date': 1 } },
      ],
    },
    {
      collection: names.documentVersions,
      indexes: [
        { key: { tenantId: 1, documentId: 1, versionNumber: -1 }, unique: true },
        { key: { tenantId: 1, 'file.sha256': 1 } },
        { key: { 'classification.classId': 1, tenantId: 1 } },
        { key: { tenantId: 1, createdAt: -1 } },
      ],
    },
    {
      collection: names.processingJobs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, status: 1 } },
        { key: { tenantId: 1, updatedAt: 1 } },
        { key: { tenantId: 1, versionId: 1 } },
      ],
    },
    {
      collection: names.auditLogs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, action: 1, createdAt: -1 } },
        { key: { 'actor.userId': 1, tenantId: 1, createdAt: -1 } },
        { key: { tenantId: 1, createdAt: -1 } },
      ],
    },
  );

  return out;
}

/**
 * Índice único cuja chave mudou não é substituído por `ensureIndexes` — o casamento é por forma de
 * chave, então o antigo sobrevive ao lado do novo e continua barrando escrita legítima. Derrubar
 * pelo nome é a única saída, e tem de acontecer aqui: este script é o que o Compose executa.
 */
async function dropSupersededIndexes() {
  const db = await getDb();
  const collection = db.collection(SHARED_APP_COLLECTIONS.approvalRequests);
  for (const name of SUPERSEDED_APPROVAL_REQUEST_INDEXES) {
    try {
      await collection.dropIndex(name);
      results.push({ collection: collection.collectionName, name, status: 'dropped' });
    } catch {
      // Não existe: nada a fazer.
    }
  }
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const db = await getDb();
  const database = getMongoDatabaseName();

  for (const group of registryIndexes()) {
    await ensureIndexes(group.collection, group.indexes);
  }

  await dropSupersededIndexes();

  for (const group of sharedAppIndexes()) {
    await ensureIndexes(group.collection, group.indexes);
  }

  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray();

  // Conjunto compartilhado: garantido uma única vez. Antes o laço rodava por tenant ativo,
  // porque cada um tinha suas próprias coleções; hoje todos resolvem para as mesmas, então
  // repetir por tenant só refaria o mesmo trabalho N vezes.
  for (const group of tenantScopedIndexes(resolveSharedCollections())) {
    await ensureIndexes(group.collection, group.indexes);
  }

  const report = createReportWriter();
  report.line('DOQYN — Relatório de índices MongoDB');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${database}`);
  report.line('Relatório sanitizado.');

  report.section('RESUMO');
  const created = results.filter((r) => r.status === 'created').length;
  const existing = results.filter((r) => r.status === 'existing').length;
  const dropped = results.filter((r) => r.status === 'dropped').length;
  const errors = results.filter((r) => r.status === 'error').length;
  report.line(`Índices criados: ${created}`);
  report.line(`Índices já existentes: ${existing}`);
  report.line(`Índices substituídos removidos: ${dropped}`);
  report.line(`Erros: ${errors}`);
  report.line(`Tenants ativos processados: ${tenants.length}`);

  report.section('DETALHES');
  for (const r of results) {
    report.line(`${r.collection} | ${r.name} | ${r.status}${r.error ? ` | ${r.error}` : ''}`);
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(
    `Database: ${database} | Criados: ${created} | Existentes: ${existing} | Erros: ${errors}`,
  );

  await closeMongoConnection();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
