import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from '../../server/db/constants.js';
import { getDb } from '../../server/db/mongoClient.js';
import type { MongoTenant } from '../../server/db/types.js';
import { ensureDevTenantSeed } from '../../server/services/tenantsService.js';
import { provisionTenantEnvironment } from '../../server/services/tenantProvisionService.js';
import { buildBusinessCollectionPrefix, hashTaxId, maskTaxId } from '../../server/tenancy/taxId.js';
import { slugifyName } from '../../server/utils/slugify.js';
import type { DemoSeedManifest, DemoSeedManifestCompany } from './manifest.js';
import { buildGovernanceSeedForTenant } from './governance.js';
import { syncDevTenantMembers } from './syncMembers.js';
import { registerTenantStoragePlan } from '../../server/services/tenantStorageConfigService.js';

export type ProvisionDemoTenantsResult = {
  devTenantId: string;
  devOperatorEmails: string[];
  provisionedTenants: string[];
  governanceSeededTenants: string[];
};

async function upsertTenantRegistry(company: DemoSeedManifestCompany) {
  const db = await getDb();
  const now = new Date();
  const taxIdHash = hashTaxId(company.cnpj);
  const taxIdMasked = maskTaxId(company.cnpj);

  const tenantFields: Partial<MongoTenant> & Record<string, unknown> = {
    tenantId: company.tenantId,
    companyId: company.tenantId,
    tenantType: 'business',
    taxIdType: 'CNPJ',
    taxIdMasked,
    taxIdHash,
    displayName: company.displayName,
    legalName: company.legalName,
    slug: company.slug || slugifyName(company.displayName) || company.tenantId,
    status: 'active',
    isolation: {
      strategy: 'collection_prefix',
      collectionPrefix: buildBusinessCollectionPrefix(company.tenantId),
      storageMode: 'dedicated_collections',
    },
    updatedAt: now,
  };

  await db.collection(REGISTRY_COLLECTIONS.tenants).updateOne(
    { tenantId: company.tenantId } as Record<string, unknown>,
    {
      $setOnInsert: {
        _id: `tenant_${company.tenantId}`,
        createdAt: now,
      },
      $set: tenantFields,
    },
    { upsert: true },
  );
}

async function seedGovernanceForTenant(tenantId: string) {
  const db = await getDb();
  const seed = buildGovernanceSeedForTenant(tenantId);
  const prefix = buildBusinessCollectionPrefix(tenantId);

  const categoriesCollection = `document_categories_${prefix}`;
  const groupsCollection = `document_groups_${prefix}`;
  const rulesCollection = `document_rules_${prefix}`;
  const extractionCollection = `document_extraction_rules_${prefix}`;

  for (const category of seed.categories) {
    await db.collection(categoriesCollection).updateOne(
      { _id: category._id } as Record<string, unknown>,
      { $set: category },
      { upsert: true },
    );
  }

  for (const group of seed.groups) {
    await db.collection(groupsCollection).updateOne(
      { _id: group._id } as Record<string, unknown>,
      { $set: group },
      { upsert: true },
    );
  }

  for (const rule of seed.accessRules) {
    await db.collection(rulesCollection).updateOne(
      { _id: rule._id } as Record<string, unknown>,
      { $set: rule },
      { upsert: true },
    );
  }

  for (const extractionRule of seed.extractionRules) {
    await db.collection(extractionCollection).updateOne(
      { _id: extractionRule._id } as Record<string, unknown>,
      { $set: extractionRule },
      { upsert: true },
    );
  }
}

async function registerDemoTenantStorage(
  tenant: Pick<MongoTenant, 'tenantId' | 'displayName' | 'slug' | 'tenantType'>,
) {
  const storage = await registerTenantStoragePlan(tenant);
  return storage.bucketName;
}

async function provisionDevTenant(manifest: DemoSeedManifest): Promise<string> {
  const tenant = await ensureDevTenantSeed();

  await provisionTenantEnvironment({
    tenantId: DEV_TENANT_ID,
    tenantType: 'business',
    displayName: tenant.displayName,
    collectionPrefix: DEV_TENANT_ID,
    createdByUserId: manifest.globalAdmin.userId,
    createdByMembershipId: manifest.globalAdmin.membershipId,
  });

  await seedGovernanceForTenant(DEV_TENANT_ID);
  await registerDemoTenantStorage({
    tenantId: DEV_TENANT_ID,
    displayName: tenant.displayName,
    slug: tenant.slug,
    tenantType: 'business',
  });
  return DEV_TENANT_ID;
}

export async function provisionDemoTenants(
  manifest: DemoSeedManifest,
): Promise<ProvisionDemoTenantsResult> {
  const devTenantId = await provisionDevTenant(manifest);
  const devOperatorEmails = await syncDevTenantMembers(manifest);

  const provisionedTenants: string[] = [devTenantId];
  const governanceSeededTenants: string[] = [devTenantId];

  for (const company of manifest.companies) {
    await provisionTenantEnvironment({
      tenantId: company.tenantId,
      tenantType: 'business',
      displayName: company.displayName,
      collectionPrefix: company.tenantId,
      createdByUserId: manifest.globalAdmin.userId,
      createdByMembershipId: manifest.globalAdmin.membershipId,
    });

    await upsertTenantRegistry(company);
    await seedGovernanceForTenant(company.tenantId);
    await registerDemoTenantStorage({
      tenantId: company.tenantId,
      displayName: company.displayName,
      slug: company.slug,
      tenantType: 'business',
    });

    provisionedTenants.push(company.tenantId);
    governanceSeededTenants.push(company.tenantId);
  }

  return {
    devTenantId,
    devOperatorEmails,
    provisionedTenants,
    governanceSeededTenants,
  };
}
