import { randomUUID } from 'node:crypto';
import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { MongoTenant, TenantStatus, TenantType } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { slugifyName } from '../utils/slugify.js';
import {
  buildBusinessCollectionPrefix,
  buildIndividualPoolPrefix,
  detectTaxIdType,
  hashTaxId,
  maskTaxId,
  validateTaxId,
  type TaxIdType,
} from '../tenancy/taxId.js';

export async function getTenantById(tenantId: string): Promise<MongoTenant | null> {
  const db = await getDb();
  return db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    $or: [{ tenantId }, { companyId: tenantId }],
  } as Record<string, unknown>);
}

export async function getTenantByTaxIdHash(taxIdHash: string): Promise<MongoTenant | null> {
  const db = await getDb();
  return db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    taxIdHash,
  } as Record<string, unknown>);
}

export async function assertActiveTenant(tenantId: string): Promise<MongoTenant> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new ServiceError('Cliente não encontrado.', 'TENANT_NOT_FOUND', 404);
  }
  if (tenant.status !== 'active') {
    throw new ServiceError('Cliente inativo.', 'TENANT_INACTIVE', 400);
  }
  return tenant;
}

/** @deprecated Use assertActiveTenant */
export async function assertActiveCompany(tenantId: string): Promise<MongoTenant> {
  return assertActiveTenant(tenantId);
}

/** CNPJ placeholder exclusivo de desenvolvimento — não usar documento real. */
const DEV_TENANT_PLACEHOLDER_CNPJ = '00000000000100';

export async function ensureDevTenantSeed(): Promise<MongoTenant> {
  const db = await getDb();
  const now = new Date();
  const devTaxIdHash = hashTaxId(DEV_TENANT_PLACEHOLDER_CNPJ);

  const tenantFields = {
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    tenantType: 'business' as const,
    country: 'BR',
    taxIdType: 'cnpj',
    taxIdMasked: '00.000.000/0001-00',
    taxIdHash: devTaxIdHash,
    displayName: 'DOQYN Dev',
    legalName: 'DOQYN Dev Environment',
    slug: 'doqyn-dev',
    status: 'active' as const,
    isolation: {
      strategy: 'collection_prefix' as const,
      collectionPrefix: buildBusinessCollectionPrefix(DEV_TENANT_ID),
    },
    updatedAt: now,
  };

  await db.collection(REGISTRY_COLLECTIONS.tenants).updateOne(
    { tenantId: DEV_TENANT_ID } as Record<string, unknown>,
    {
      $setOnInsert: {
        _id: 'tenant_dev_record',
        createdAt: now,
      },
      $set: tenantFields,
    },
    { upsert: true },
  );

  const tenant = await getTenantById(DEV_TENANT_ID);
  if (!tenant) {
    throw new ServiceError('Falha ao garantir tenant de desenvolvimento.', 'TENANT_SEED_FAILED', 500);
  }
  return tenant;
}

/** @deprecated Use ensureDevTenantSeed */
export async function ensureDevCompanySeed(): Promise<void> {
  await ensureDevTenantSeed();
}

export async function listActiveTenants(): Promise<MongoTenant[]> {
  const db = await getDb();
  return db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .sort({ displayName: 1 })
    .toArray();
}

function buildTenantId(tenantType: TenantType): string {
  const suffix = randomUUID().slice(0, 8);
  return tenantType === 'individual' ? `tenant_pf_${suffix}` : `tenant_pj_${suffix}`;
}

export async function findOrCreateTenantByTaxId(input: {
  taxId: string;
  tenantType: TenantType;
  displayName: string;
  legalName?: string;
  status?: TenantStatus;
}): Promise<{ tenant: MongoTenant; created: boolean }> {
  const taxIdType: TaxIdType = input.tenantType === 'individual' ? 'CPF' : 'CNPJ';

  if (!validateTaxId(input.taxId, taxIdType)) {
    throw new ServiceError(`${taxIdType} inválido.`, 'INVALID_TAX_ID', 400);
  }

  const detected = detectTaxIdType(input.taxId);
  if (detected !== taxIdType) {
    throw new ServiceError(
      `Tipo de documento incompatível com ${input.tenantType === 'individual' ? 'Pessoa Física' : 'Pessoa Jurídica'}.`,
      'TAX_ID_TYPE_MISMATCH',
      400,
    );
  }

  const taxIdHash = hashTaxId(input.taxId);
  const existing = await getTenantByTaxIdHash(taxIdHash);
  if (existing) {
    return { tenant: existing, created: false };
  }

  const now = new Date();
  const tenantId = buildTenantId(input.tenantType);
  const slugBase = slugifyName(input.displayName) || tenantId;
  const collectionPrefix =
    input.tenantType === 'individual'
      ? buildIndividualPoolPrefix()
      : buildBusinessCollectionPrefix(tenantId);

  const tenant: MongoTenant = {
    _id: `tenant_${tenantId}`,
    tenantId,
    companyId: tenantId,
    tenantType: input.tenantType,
    taxIdType,
    taxIdMasked: maskTaxId(input.taxId, taxIdType),
    taxIdHash,
    displayName: input.displayName.trim(),
    legalName: input.legalName?.trim() || input.displayName.trim(),
    slug: slugBase,
    status: input.status ?? 'pending',
    isolation: {
      strategy: input.tenantType === 'individual' ? 'shared_individual_pool' : 'collection_prefix',
      collectionPrefix,
    },
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.collection(REGISTRY_COLLECTIONS.tenants).insertOne(tenant as Record<string, unknown>);

  return { tenant, created: true };
}
