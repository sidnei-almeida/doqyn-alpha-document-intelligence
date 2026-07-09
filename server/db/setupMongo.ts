import 'dotenv/config';
import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from './constants.js';
import { getMongoDatabaseName } from './database.js';
import { closeMongoConnection, getDb } from './mongoClient.js';
import { ensureDevTenantSeed } from '../services/tenantsService.js';
import { ensureSidneiDevTenantMember } from '../services/tenantMembersService.js';
import {
  resolveTenantCollectionNames,
  type ResolvedTenantCollectionNames,
} from '../tenancy/tenantResolver.js';

type SeedCounts = {
  documentCategories: number;
  documentGroups: number;
  documentGroupMembers: number;
  documentRules: number;
  documentExtractionRules: number;
  companyMembers: number;
};

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

  const { ensureUserDocumentFavoritesIndexes } = await import('./userDocumentFavoritesIndexes.js');
  await ensureUserDocumentFavoritesIndexes();
  const { ensureDocumentShareGrantsIndexes } = await import('./documentShareGrantsIndexes.js');
  await ensureDocumentShareGrantsIndexes();
  const { ensureExternalDocumentShareGrantsIndexes } = await import(
    './externalDocumentShareGrantsIndexes.js'
  );
  await ensureExternalDocumentShareGrantsIndexes();
  const { ensureDocumentSignatureRequestsIndexes, ensureDocumentSignaturesIndexes } = await import(
    './documentSignatureIndexes.js'
  );
  await ensureDocumentSignatureRequestsIndexes();
  await ensureDocumentSignaturesIndexes();
}

async function ensureTenantDataIndexes(names: ResolvedTenantCollectionNames) {
  const db = await getDb();

  if (names.documentCategories) {
    await db.collection(names.documentCategories).createIndexes([
      { key: { tenantId: 1, active: 1 } },
      { key: { tenantId: 1, slug: 1 }, unique: true },
    ]);
  }

  if (names.documentGroups) {
    await db.collection(names.documentGroups).createIndexes([
      { key: { tenantId: 1, active: 1 } },
      { key: { tenantId: 1, slug: 1 }, unique: true },
    ]);
  }

  if (names.documentGroupMembers) {
    await db.collection(names.documentGroupMembers).createIndexes([
      { key: { tenantId: 1, groupId: 1, active: 1 } },
      { key: { tenantId: 1, membershipId: 1, active: 1 } },
      { key: { tenantId: 1, groupId: 1, membershipId: 1 }, unique: true },
    ]);
  }

  if (names.documentRules) {
    await db.collection(names.documentRules).createIndexes([
      { key: { tenantId: 1, groupId: 1, categoryId: 1 }, unique: true },
      { key: { tenantId: 1, active: 1 } },
    ]);
  }

  if (names.documentExtractionRules) {
    await db.collection(names.documentExtractionRules).createIndexes([
      { key: { tenantId: 1, categoryId: 1, active: 1 } },
      { key: { tenantId: 1, categoryId: 1, version: -1 } },
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

async function getSeedCounts(names: ResolvedTenantCollectionNames): Promise<SeedCounts> {
  const db = await getDb();
  const tenantFilter = { $or: [{ tenantId: DEV_TENANT_ID }, { companyId: DEV_TENANT_ID }] };

  const [
    documentCategories,
    documentGroups,
    documentGroupMembers,
    documentRules,
    documentExtractionRules,
    companyMembers,
  ] = await Promise.all([
    names.documentCategories
      ? db.collection(names.documentCategories).countDocuments(tenantFilter)
      : Promise.resolve(0),
    names.documentGroups
      ? db.collection(names.documentGroups).countDocuments(tenantFilter)
      : Promise.resolve(0),
    names.documentGroupMembers
      ? db.collection(names.documentGroupMembers).countDocuments(tenantFilter)
      : Promise.resolve(0),
    names.documentRules
      ? db.collection(names.documentRules).countDocuments({ ...tenantFilter, active: true })
      : Promise.resolve(0),
    names.documentExtractionRules
      ? db.collection(names.documentExtractionRules).countDocuments({ ...tenantFilter, active: true })
      : Promise.resolve(0),
    db.collection(REGISTRY_COLLECTIONS.companyMembers).countDocuments(tenantFilter),
  ]);

  return {
    documentCategories,
    documentGroups,
    documentGroupMembers,
    documentRules,
    documentExtractionRules,
    companyMembers,
  };
}

async function main() {
  const database = getMongoDatabaseName();
  console.log(`Configurando MongoDB DOQYN (database: ${database}, tenantId: ${DEV_TENANT_ID})...`);
  console.log('Modo dev: não cria grupos documentais, categorias ou regras padrão.');

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

  const counts = await getSeedCounts(collectionNames);
  console.log('Totais no database (sem seed de governança):', { database, tenantId: DEV_TENANT_ID, ...counts });
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
