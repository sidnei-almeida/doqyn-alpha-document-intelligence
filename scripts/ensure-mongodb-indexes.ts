import 'dotenv/config';
import { join } from 'node:path';
import type { IndexDescription } from 'mongodb';
import { REGISTRY_COLLECTIONS, SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveSharedCollections } from '../server/tenancy/tenantStorage.js';
import {
  NOTIFICATION_DELIVERY_INDEXES,
  NOTIFICATION_INDEXES,
} from '../server/db/notificationIndexes.js';
import { ANALYSIS_JOB_INDEXES } from '../server/db/analysisJobIndexes.js';
import { ensureApprovalRequestIndexes } from '../server/db/approvalRequestIndexes.js';
import { DOCUMENT_REQUEST_INDEXES } from '../server/db/documentRequestIndexes.js';
import { DOCUMENT_SHARE_GRANTS_INDEXES } from '../server/db/documentShareGrantsIndexes.js';
import {
  ensureIndexesForCollection,
  ensureRegistryTenantIndexes,
  tenantScopedIndexSpecs,
  type IndexEnsureResult,
} from '../server/db/tenantIndexes.js';
import { createReportWriter } from './lib/reportUtils.js';

/**
 * O job de operação não aborta no primeiro índice que falha.
 *
 * Ele percorre a base inteira; parar na primeira exceção deixaria todas as coleções seguintes sem
 * índice por causa de uma. A falha vira linha de relatório, e o código de saída no fim diz que
 * houve erro.
 */
const CONTINUA = { continueOnError: true } as const;

async function ensureIndexes(collectionName: string, indexes: IndexDescription[]) {
  results.push(...(await ensureIndexesForCollection(collectionName, indexes, CONTINUA)));
}

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_INDICES_MONGODB.txt');

const results: IndexEnsureResult[] = [];

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

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const db = await getDb();
  const database = getMongoDatabaseName();

  results.push(...(await ensureRegistryTenantIndexes(CONTINUA)));

  for (const group of sharedAppIndexes()) {
    await ensureIndexes(group.collection, group.indexes);
  }

  // `approval_requests` passa pelo caminho próprio porque ele derruba os índices únicos de
  // versões anteriores antes de garantir os novos — o casamento por forma de chave não substitui
  // um índice cuja chave mudou, e o antigo continuaria barrando escrita legítima.
  results.push(...(await ensureApprovalRequestIndexes()));

  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray();

  // Conjunto compartilhado: garantido uma única vez. Antes o laço rodava por tenant ativo,
  // porque cada um tinha suas próprias coleções; hoje todos resolvem para as mesmas, então
  // repetir por tenant só refaria o mesmo trabalho N vezes.
  for (const group of tenantScopedIndexSpecs(resolveSharedCollections())) {
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
