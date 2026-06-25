import 'dotenv/config';
import { join } from 'node:path';
import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { AuthUser } from '../server/auth/types.js';
import { assertCanManageCompany } from '../server/auth/memberAuth.js';
import { getTenantCollections } from '../server/tenancy/getTenantCollections.js';
import { tenantScopeFilter } from '../server/tenancy/tenantQuery.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_TESTE_TENANT_ISOLATION.txt');

const TENANT_A = DEV_TENANT_ID;
const TENANT_B = 'company_test_2';

type TestResult = { name: string; status: 'PASS' | 'FAIL' | 'WARNING'; detail: string };

const results: TestResult[] = [];

function record(name: string, status: TestResult['status'], detail: string) {
  results.push({ name, status, detail });
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const colsA = await getTenantCollections(TENANT_A);
  const colsB = await getTenantCollections(TENANT_B);

  record(
    'getTenantCollections(company_dev)',
    colsA.names.documents === `documents_${TENANT_A}` ? 'PASS' : 'FAIL',
    `documents=${colsA.names.documents}`,
  );

  record(
    'getTenantCollections(company_test_2)',
    colsB.names.documents === `documents_${TENANT_B}` ? 'PASS' : 'FAIL',
    `documents=${colsB.names.documents}`,
  );

  const docsInAfromB = await colsA.documents.countDocuments({
    ...tenantScopeFilter(TENANT_B),
  });
  record(
    'Documents company_dev não contém tenant company_test_2',
    docsInAfromB === 0 ? 'PASS' : 'FAIL',
    `count=${docsInAfromB}`,
  );

  const docsInBfromA = await colsB.documents.countDocuments({
    ...tenantScopeFilter(TENANT_A),
  });
  record(
    'Documents company_test_2 não contém tenant company_dev',
    docsInBfromA === 0 ? 'PASS' : 'FAIL',
    `count=${docsInBfromA}`,
  );

  const rulesLeakA = await colsA.documentRules!.countDocuments({ ...tenantScopeFilter(TENANT_B) });
  record('Rules isoladas A', rulesLeakA === 0 ? 'PASS' : 'FAIL', `leak=${rulesLeakA}`);

  const rulesLeakB = await colsB.documentRules!.countDocuments({ ...tenantScopeFilter(TENANT_A) });
  record('Rules isoladas B', rulesLeakB === 0 ? 'PASS' : 'FAIL', `leak=${rulesLeakB}`);

  const groupsLeakA = await colsA.accessGroups!.countDocuments({ ...tenantScopeFilter(TENANT_B) });
  record('Access groups isolados A', groupsLeakA === 0 ? 'PASS' : 'FAIL', `leak=${groupsLeakA}`);

  const groupsLeakB = await colsB.accessGroups!.countDocuments({ ...tenantScopeFilter(TENANT_A) });
  record('Access groups isolados B', groupsLeakB === 0 ? 'PASS' : 'FAIL', `leak=${groupsLeakB}`);

  const logsLeakA = await colsA.auditLogs.countDocuments({ ...tenantScopeFilter(TENANT_B) });
  record('Audit logs isolados A', logsLeakA === 0 ? 'PASS' : 'FAIL', `leak=${logsLeakA}`);

  const logsLeakB = await colsB.auditLogs.countDocuments({ ...tenantScopeFilter(TENANT_A) });
  record('Audit logs isolados B', logsLeakB === 0 ? 'PASS' : 'FAIL', `leak=${logsLeakB}`);

  const actorDev: AuthUser = {
    id: 'actor-dev',
    email: 'admin@dev.test',
    name: 'Admin Dev',
    tenantId: TENANT_A,
    companyId: TENANT_A,
    roles: ['company_admin'],
    platformRoles: ['company_admin'],
    accessGroupIds: [],
  };

  let crossTenantBlocked = false;
  try {
    assertCanManageCompany(actorDev, TENANT_B);
  } catch {
    crossTenantBlocked = true;
  }
  record(
    'company_admin company_dev não aprova member company_test_2',
    crossTenantBlocked ? 'PASS' : 'FAIL',
    crossTenantBlocked ? '403 FORBIDDEN' : 'sem bloqueio',
  );

  const devDocs = await colsA.documents.find({ ...tenantScopeFilter(TENANT_A) }).toArray();
  let crossVersion = false;
  for (const doc of devDocs) {
    if (!doc.currentVersionId) continue;
    const ver = await colsB.documentVersions.findOne({ _id: doc.currentVersionId });
    if (ver) crossVersion = true;
  }
  record('Cross-tenant currentVersionId', crossVersion ? 'FAIL' : 'PASS', crossVersion ? 'versão cruzada' : 'ok');

  const db = await getDb();
  const test2Groups = await colsB.accessGroups!.find({ ...tenantScopeFilter(TENANT_B) }).toArray();
  const test2GroupIds = new Set(test2Groups.map((g) => g._id));

  const devMembers = await db
    .collection(REGISTRY_COLLECTIONS.tenantMembers)
    .find({ ...tenantScopeFilter(TENANT_A), status: 'active' })
    .toArray();

  let crossGroupRef = false;
  for (const member of devMembers) {
    for (const gid of member.accessGroupIds ?? []) {
      if (test2GroupIds.has(gid)) crossGroupRef = true;
    }
  }

  const devDocsWithGroups = await colsA.documents.find({ ...tenantScopeFilter(TENANT_A) }).toArray();
  for (const doc of devDocsWithGroups) {
    for (const gid of doc.access?.viewGroupIds ?? []) {
      if (test2GroupIds.has(gid)) crossGroupRef = true;
    }
  }

  record(
    'Cross-tenant accessGroupIds',
    crossGroupRef ? 'FAIL' : 'PASS',
    crossGroupRef ? 'referência cruzada' : 'ok',
  );

  const report = createReportWriter();
  report.line('DOQYN — Teste de isolamento entre tenants');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Tenants: ${TENANT_A} vs ${TENANT_B}`);

  report.section('RESULTADOS');
  const fails = results.filter((r) => r.status === 'FAIL');
  const warnings = results.filter((r) => r.status === 'WARNING');
  report.line(`PASS: ${results.filter((r) => r.status === 'PASS').length}`);
  report.line(`FAIL: ${fails.length}`);
  report.line(`WARNING: ${warnings.length}`);

  for (const r of results) {
    report.line(`[${r.status}] ${r.name} — ${r.detail}`);
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(`PASS: ${results.filter((r) => r.status === 'PASS').length} | FAIL: ${fails.length}`);

  await closeMongoConnection();
  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
