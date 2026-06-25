import 'dotenv/config';
import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from './constants.js';
import { getMongoDatabaseName } from './database.js';
import { closeMongoConnection, getDb } from './mongoClient.js';
import { SEED_ACCESS_GROUPS } from './seed/accessGroupsSeed.js';
import { SEED_COMPANY_MEMBERS } from './seed/companyMembersSeed.js';
import {
  getDocumentClassPresentationBackfill,
  SEED_DOCUMENT_CLASSES,
  SEED_DOCUMENT_RULES,
} from './seed/documentRulesSeed.js';
import { ensureDevTenantSeed } from '../services/tenantsService.js';
import { ensureSidneiDevTenantMember } from '../services/tenantMembersService.js';
import {
  resolveTenantCollectionNames,
  type ResolvedTenantCollectionNames,
} from '../tenancy/tenantResolver.js';

type SeedCounts = {
  accessGroups: number;
  companyMembers: number;
  documentClasses: number;
  documentRules: number;
  documentRulesActive: number;
};

async function upsertSeed<T extends { _id: string; tenantId?: string; companyId: string }>(
  collectionName: string,
  items: T[],
): Promise<{ inserted: number; existing: number }> {
  const db = await getDb();
  const collection = db.collection(collectionName);
  let inserted = 0;
  let existing = 0;

  for (const item of items) {
    const result = await collection.updateOne(
      {
        _id: item._id,
        $or: [{ tenantId: DEV_TENANT_ID }, { companyId: DEV_TENANT_ID }],
      } as Record<string, unknown>,
      { $setOnInsert: item },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      inserted += 1;
    } else {
      existing += 1;
    }
  }

  return { inserted, existing };
}

async function ensureRegistryIndexes() {
  const db = await getDb();

  await db.collection(REGISTRY_COLLECTIONS.tenants).createIndexes([
    { key: { tenantId: 1 }, unique: true },
    { key: { taxIdHash: 1 }, unique: true },
    { key: { slug: 1 }, unique: true },
    { key: { status: 1 } },
    { key: { tenantType: 1, status: 1 } },
  ]);

  await db.collection(REGISTRY_COLLECTIONS.tenantMembers).createIndexes([
    { key: { tenantId: 1, status: 1 } },
    { key: { tenantId: 1, emailNormalized: 1 }, unique: true },
    { key: { keycloakUserId: 1, status: 1 } },
  ]);

  await db.collection(REGISTRY_COLLECTIONS.companyMembers).createIndexes([
    { key: { companyId: 1, status: 1 } },
    { key: { companyId: 1, email: 1 }, unique: true },
    { key: { companyId: 1, userId: 1 } },
    { key: { keycloakUserId: 1, status: 1 } },
  ]);

  await db.collection(REGISTRY_COLLECTIONS.companies).createIndexes([
    { key: { companyId: 1 }, unique: true },
    { key: { slug: 1 }, unique: true },
    { key: { status: 1 } },
  ]);
}

async function ensureTenantDataIndexes(names: ResolvedTenantCollectionNames) {
  const db = await getDb();

  if (names.accessGroups) {
    await db.collection(names.accessGroups).createIndexes([
      { key: { tenantId: 1, active: 1 } },
      { key: { companyId: 1, active: 1 } },
      { key: { tenantId: 1, slug: 1 }, unique: true },
    ]);
  }

  if (names.documentClasses) {
    await db.collection(names.documentClasses).createIndexes([
      { key: { tenantId: 1, active: 1 } },
      { key: { tenantId: 1, name: 1 }, unique: true },
      { key: { tenantId: 1, slug: 1 }, unique: true },
    ]);
  }

  if (names.documentRules) {
    await db.collection(names.documentRules).createIndexes([
      { key: { tenantId: 1, classId: 1, active: 1 } },
      { key: { tenantId: 1, classId: 1, version: -1 } },
    ]);
  }

  await db.collection(names.documents).createIndexes([
    { key: { tenantId: 1, status: 1, updatedAt: -1 } },
    { key: { tenantId: 1, ownerUserId: 1, updatedAt: -1 } },
    { key: { tenantId: 1, classId: 1, updatedAt: -1 } },
  ]);

  await db.collection(names.documentVersions).createIndexes([
    { key: { tenantId: 1, documentId: 1, versionNumber: -1 }, unique: true },
    { key: { tenantId: 1, 'file.sha256': 1 } },
  ]);

  await db.collection(names.processingJobs).createIndexes([
    { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
    { key: { tenantId: 1, status: 1 } },
  ]);

  await db.collection(names.auditLogs).createIndexes([
    { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
    { key: { tenantId: 1, action: 1, createdAt: -1 } },
  ]);
}

async function seedDocumentClasses(collectionName: string) {
  const db = await getDb();
  const collection = db.collection(collectionName);
  let inserted = 0;
  let existing = 0;
  let backfilled = 0;

  for (const docClass of SEED_DOCUMENT_CLASSES) {
    const result = await collection.updateOne(
      {
        _id: docClass._id,
        $or: [{ tenantId: DEV_TENANT_ID }, { companyId: DEV_TENANT_ID }],
      } as Record<string, unknown>,
      { $setOnInsert: docClass },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      inserted += 1;
      continue;
    }

    existing += 1;

    const backfillResult = await collection.updateOne(
      {
        _id: docClass._id,
        $or: [{ tenantId: DEV_TENANT_ID }, { companyId: DEV_TENANT_ID }],
        slug: { $exists: false },
      } as Record<string, unknown>,
      { $set: getDocumentClassPresentationBackfill(docClass) },
    );

    if (backfillResult.modifiedCount > 0) {
      backfilled += 1;
    }
  }

  return { inserted, existing, backfilled };
}

async function getSeedCounts(names: ResolvedTenantCollectionNames): Promise<SeedCounts> {
  const db = await getDb();
  const tenantFilter = { $or: [{ tenantId: DEV_TENANT_ID }, { companyId: DEV_TENANT_ID }] };

  const [accessGroups, companyMembers, documentClasses, documentRules, documentRulesActive] =
    await Promise.all([
      names.accessGroups
        ? db.collection(names.accessGroups).countDocuments(tenantFilter)
        : Promise.resolve(0),
      db.collection(REGISTRY_COLLECTIONS.companyMembers).countDocuments(tenantFilter),
      names.documentClasses
        ? db.collection(names.documentClasses).countDocuments(tenantFilter)
        : Promise.resolve(0),
      names.documentRules
        ? db.collection(names.documentRules).countDocuments(tenantFilter)
        : Promise.resolve(0),
      names.documentRules
        ? db
            .collection(names.documentRules)
            .countDocuments({ ...tenantFilter, active: true })
        : Promise.resolve(0),
    ]);

  return {
    accessGroups,
    companyMembers,
    documentClasses,
    documentRules,
    documentRulesActive,
  };
}

async function verifyNdaSeed(database: string, names: ResolvedTenantCollectionNames) {
  const db = await getDb();
  const tenantFilter = { $or: [{ tenantId: DEV_TENANT_ID }, { companyId: DEV_TENANT_ID }] };

  const docClass = names.documentClasses
    ? await db.collection(names.documentClasses).findOne({
        _id: 'class_confidentiality_agreement',
        ...tenantFilter,
        active: true,
      } as Record<string, unknown>)
    : null;

  const rule = names.documentRules
    ? await db.collection(names.documentRules).findOne({
        _id: 'rule_confidentiality_agreement_v1',
        ...tenantFilter,
        classId: 'class_confidentiality_agreement',
        active: true,
      } as Record<string, unknown>)
    : null;

  console.log('Validação NDA:', {
    database,
    tenantId: DEV_TENANT_ID,
    classFound: Boolean(docClass),
    className: docClass?.name ?? null,
    ruleFound: Boolean(rule),
    ruleId: rule?._id ?? null,
    collections: names,
  });
}

async function main() {
  const database = getMongoDatabaseName();
  console.log(`Configurando MongoDB DOQYN (database: ${database}, tenantId: ${DEV_TENANT_ID})...`);

  await ensureRegistryIndexes();
  console.log('Índices de registro (tenants/members) criados/verificados.');

  const tenant = await ensureDevTenantSeed();
  const sidneiMember = await ensureSidneiDevTenantMember();
  console.log(
    `tenant_members (sidnei): vinculado ao tenant ${sidneiMember.tenantId} (${sidneiMember.status}).`,
  );
  const collectionNames = resolveTenantCollectionNames(tenant);
  await ensureTenantDataIndexes(collectionNames);
  console.log('Índices tenant-aware criados/verificados.', collectionNames);

  const groups = collectionNames.accessGroups
    ? await upsertSeed(collectionNames.accessGroups, SEED_ACCESS_GROUPS)
    : { inserted: 0, existing: 0 };
  console.log(`access_groups: ${groups.inserted} inserido(s), ${groups.existing} já existente(s).`);

  const members = await upsertSeed(REGISTRY_COLLECTIONS.companyMembers, SEED_COMPANY_MEMBERS);
  console.log(`company_members: ${members.inserted} inserido(s), ${members.existing} já existente(s).`);

  const classes = collectionNames.documentClasses
    ? await seedDocumentClasses(collectionNames.documentClasses)
    : { inserted: 0, existing: 0, backfilled: 0 };
  console.log(
    `document_classes: ${classes.inserted} inserido(s), ${classes.existing} já existente(s), ${classes.backfilled} backfill.`,
  );

  const rules = collectionNames.documentRules
    ? await upsertSeed(collectionNames.documentRules, SEED_DOCUMENT_RULES)
    : { inserted: 0, existing: 0 };
  console.log(`document_rules: ${rules.inserted} inserido(s), ${rules.existing} já existente(s).`);

  const counts = await getSeedCounts(collectionNames);
  console.log('Totais no database:', { database, tenantId: DEV_TENANT_ID, ...counts });

  await verifyNdaSeed(database, collectionNames);
}

main()
  .then(async () => {
    await closeMongoConnection();
    console.log('Setup MongoDB finalizado.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Falha no setup MongoDB:', error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
