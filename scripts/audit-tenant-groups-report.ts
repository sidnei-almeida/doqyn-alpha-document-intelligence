import 'dotenv/config';
import { closeMongoConnection, getDb } from '../server/db/mongoClient.js';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveTenantCollectionNames } from '../server/tenancy/tenantResolver.js';

type TenantSummary = {
  tenantId: string;
  tenantType?: string;
  status?: string;
  documentGroups: number;
  documentCategories: number;
  documentRules: number;
  documentExtractionRules: number;
};

async function countTenantScoped(
  collectionName: string | undefined,
  tenantId: string,
): Promise<number> {
  if (!collectionName) return 0;
  const db = await getDb();
  return db.collection(collectionName).countDocuments({
    $or: [{ tenantId }, { companyId: tenantId }],
  });
}

async function main() {
  const db = await getDb();
  const tenants = await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .find({}, { projection: { tenantId: 1, tenantType: 1, status: 1, isolation: 1 } })
    .sort({ tenantId: 1 })
    .toArray();

  const summaries: TenantSummary[] = [];

  for (const raw of tenants) {
    const tenant = raw as MongoTenant;
    const tenantId = String(tenant.tenantId ?? '');
    if (!tenantId) continue;

    const names = resolveTenantCollectionNames(tenant);

    summaries.push({
      tenantId,
      tenantType: tenant.tenantType,
      status: tenant.status,
      documentGroups: await countTenantScoped(names.documentGroups, tenantId),
      documentCategories: await countTenantScoped(names.documentCategories, tenantId),
      documentRules: await countTenantScoped(names.documentRules, tenantId),
      documentExtractionRules: await countTenantScoped(names.documentExtractionRules, tenantId),
    });
  }

  const legacyAccessGroups = await db.collection('access_groups').countDocuments({});
  const companyMembersMissingTenant = await db.collection(REGISTRY_COLLECTIONS.companyMembers).countDocuments({
    $and: [
      { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }] },
      { $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }] },
    ],
  });

  const report = {
    generatedAt: new Date().toISOString(),
    database: db.databaseName,
    tenantCount: summaries.length,
    tenants: summaries,
    orphanChecks: {
      companyMembersMissingTenant,
      legacyAccessGroupsFlat: legacyAccessGroups,
    },
    notes: [
      'Access groups de produção vivem no auth-service (Postgres), não neste relatório Mongo.',
      'Coleção flat access_groups é legado — não deve ser usada em tenants novos.',
      'Nenhum dado foi alterado por este relatório.',
    ],
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('Falha ao gerar relatório:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoConnection();
  });
