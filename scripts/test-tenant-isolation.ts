import 'dotenv/config';
import { join } from 'node:path';
import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { AuthUser } from '../server/auth/types.js';
import { assertCanManageCompany } from '../server/auth/memberAuth.js';
import { getTenantCollections } from '../server/tenancy/getTenantCollections.js';
import { buildDocumentOwnershipFilter } from '../server/tenancy/documentOwnership.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_TESTE_TENANT_ISOLATION.txt');

const TENANT_A = DEV_TENANT_ID;
const TENANT_B = 'company_test_2';

type TestResult = { name: string; status: 'PASS' | 'FAIL' | 'WARNING'; detail: string };

const results: TestResult[] = [];

function record(name: string, status: TestResult['status'], detail: string) {
  results.push({ name, status, detail });
}

function belongsTo(doc: Record<string, unknown>, tenantId: string): boolean {
  return doc.tenantId === tenantId || doc.companyId === tenantId;
}

/**
 * Teste de isolamento no modelo de coleções compartilhadas (Passo 7).
 *
 * A versão anterior comparava **nomes de coleção** (`documents_company_dev` vs
 * `documents_company_test_2`) — checagem que perdeu o sentido: agora os dois tenants usam a mesma
 * coleção física, de propósito. O isolamento passou a ser responsabilidade do filtro de ownership,
 * então é ele que este script exercita: nenhuma consulta escopada por um tenant pode devolver
 * documento de outro, nem documento sem dono.
 */
async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const colsA = await getTenantCollections(TENANT_A);
  const colsB = await getTenantCollections(TENANT_B);

  record(
    'Tenants distintos compartilham a mesma coleção',
    colsA.names.documents === colsB.names.documents ? 'PASS' : 'FAIL',
    `A=${colsA.names.documents} B=${colsB.names.documents}`,
  );

  record(
    'Nome de coleção não carrega tenant',
    !colsA.names.documents.includes(TENANT_A) && !colsB.names.documents.includes(TENANT_B)
      ? 'PASS'
      : 'FAIL',
    `documents=${colsA.names.documents}`,
  );

  const filterA = buildDocumentOwnershipFilter(colsA.storage);
  const filterB = buildDocumentOwnershipFilter(colsB.storage);

  // O teste que importa: a consulta escopada por A não pode alcançar documento de B.
  const docsVisibleToA = await colsA.documents.find(filterA).toArray();
  const leakedToA = docsVisibleToA.filter((doc) => belongsTo(doc, TENANT_B));
  record(
    'Consulta escopada em A não devolve documento de B',
    leakedToA.length === 0 ? 'PASS' : 'FAIL',
    `visíveis=${docsVisibleToA.length} vazados=${leakedToA.length}`,
  );

  const docsVisibleToB = await colsB.documents.find(filterB).toArray();
  const leakedToB = docsVisibleToB.filter((doc) => belongsTo(doc, TENANT_A));
  record(
    'Consulta escopada em B não devolve documento de A',
    leakedToB.length === 0 ? 'PASS' : 'FAIL',
    `visíveis=${docsVisibleToB.length} vazados=${leakedToB.length}`,
  );

  // Documento sem tenantId não pode ser visível para ninguém. Em coleção dedicada isso era
  // tolerado; em coleção compartilhada seria vazamento para todos os tenants.
  const orphanTotal = await colsA.documents.countDocuments({
    tenantId: { $in: [null, undefined] },
    companyId: { $in: [null, undefined] },
  } as Record<string, unknown>);
  const orphanVisible = docsVisibleToA.filter(
    (doc) => !doc.tenantId && !(doc as Record<string, unknown>).companyId,
  ).length;
  record(
    'Documento sem tenantId é invisível',
    orphanVisible === 0 ? 'PASS' : 'FAIL',
    `órfãos no banco=${orphanTotal} visíveis=${orphanVisible}`,
  );

  for (const [label, cols, tenantId, otherTenantId] of [
    ['A', colsA, TENANT_A, TENANT_B],
    ['B', colsB, TENANT_B, TENANT_A],
  ] as const) {
    const scope = buildDocumentOwnershipFilter(cols.storage);

    const rules = cols.documentRules
      ? (await cols.documentRules.find(scope).toArray()).filter((row) =>
          belongsTo(row as Record<string, unknown>, otherTenantId),
        ).length
      : 0;
    record(`Regras isoladas em ${label}`, rules === 0 ? 'PASS' : 'FAIL', `vazados=${rules}`);

    const logs = (await cols.auditLogs.find(scope).limit(500).toArray()).filter((row) =>
      belongsTo(row as Record<string, unknown>, otherTenantId),
    ).length;
    record(`Audit logs isolados em ${label}`, logs === 0 ? 'PASS' : 'FAIL', `vazados=${logs}`);

    void tenantId;
  }

  const actorDev: AuthUser = {
    id: 'actor-dev',
    email: 'admin@dev.test',
    name: 'Admin Dev',
    tenantId: TENANT_A,
    companyId: TENANT_A,
    companyName: 'Tenant A',
    // AuthRole não tem company_admin — esse valor é de platformRoles, logo abaixo.
    // assertCanManageCompany decide por tenantId, então o caso de teste segue valendo.
    role: 'admin',
    area: 'Administração',
    groups: [],
    platformRoles: ['company_admin'],
  };

  let crossTenantBlocked = false;
  try {
    assertCanManageCompany(actorDev, TENANT_B);
  } catch {
    crossTenantBlocked = true;
  }
  record(
    'company_admin de A não administra B',
    crossTenantBlocked ? 'PASS' : 'FAIL',
    crossTenantBlocked ? '403 FORBIDDEN' : 'sem bloqueio',
  );

  // Versão referenciada por documento de A não pode pertencer a B.
  let crossVersion = 0;
  for (const doc of docsVisibleToA) {
    if (!doc.currentVersionId) continue;
    const version = await colsA.documentVersions.findOne({
      _id: doc.currentVersionId,
    } as Record<string, unknown>);
    if (version && belongsTo(version as Record<string, unknown>, TENANT_B)) crossVersion += 1;
  }
  record(
    'currentVersionId não aponta para versão de outro tenant',
    crossVersion === 0 ? 'PASS' : 'FAIL',
    `cruzadas=${crossVersion}`,
  );

  const db = await getDb();
  const groupsOfB = colsB.documentGroups
    ? await colsB.documentGroups.find(filterB).toArray()
    : [];
  const groupIdsOfB = new Set(groupsOfB.map((group) => String(group._id)));

  let crossGroupRef = 0;
  const membersOfA = await db
    .collection(REGISTRY_COLLECTIONS.tenantMembers)
    .find({ $or: [{ tenantId: TENANT_A }, { companyId: TENANT_A }], status: 'active' })
    .toArray();

  for (const member of membersOfA) {
    for (const groupId of (member.accessGroupIds as string[]) ?? []) {
      if (groupIdsOfB.has(String(groupId))) crossGroupRef += 1;
    }
  }

  for (const doc of docsVisibleToA) {
    for (const groupId of doc.access?.viewGroupIds ?? []) {
      if (groupIdsOfB.has(String(groupId))) crossGroupRef += 1;
    }
  }

  record(
    'Sem referência cruzada a grupos de outro tenant',
    crossGroupRef === 0 ? 'PASS' : 'FAIL',
    `referências=${crossGroupRef}`,
  );

  const report = createReportWriter();
  report.line('DOQYN — Teste de isolamento entre tenants (coleções compartilhadas)');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Tenants: ${TENANT_A} vs ${TENANT_B}`);
  report.line(`Coleção de documentos: ${colsA.names.documents} (compartilhada)`);

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
