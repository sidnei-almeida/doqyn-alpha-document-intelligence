import { randomUUID } from 'node:crypto';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { TenantType } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import {
  ensureRegistryTenantIndexes,
  ensureSharedCollectionIndexes,
  type IndexEnsureResult,
} from '../db/tenantIndexes.js';
import { isUnsafeCollectionPrefix } from '../tenancy/collectionGuard.js';
import { invalidateTenantRegistryCache } from '../tenancy/tenantRegistryCache.js';
import { resolveSharedCollections, type TenantStorageMode } from '../tenancy/tenantStorage.js';
import {
  buildBusinessCollectionPrefix,
  SHARED_INDIVIDUAL_COLLECTION_PREFIX,
} from '../tenancy/taxId.js';
import { isSafeTenantIdentifier } from '../utils/tenantId.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { slugifyName } from '../utils/slugify.js';
import { getTenantById } from './tenantsService.js';

export type ProvisionTenantInput = {
  tenantId: string;
  tenantType: TenantType;
  displayName: string;
  collectionPrefix: string;
  createdByUserId: string;
  createdByMembershipId: string;
};

export type ProvisionTenantOutput = {
  ok: true;
  tenantId: string;
  tenantType: TenantType;
  storageMode: TenantStorageMode;
  collectionPrefix: string;
  createdCollections: string[];
  createdIndexes: string[];
};

function assertProvisionInput(input: ProvisionTenantInput): void {
  if (!isSafeTenantIdentifier(input.tenantId)) {
    throw new ServiceError('tenantId inválido.', 'INVALID_TENANT_ID', 400);
  }

  if (isUnsafeCollectionPrefix(input.collectionPrefix)) {
    throw new ServiceError(
      'collectionPrefix não pode ser CPF/CNPJ cru.',
      'UNSAFE_COLLECTION_PREFIX',
      400,
    );
  }

  if (input.tenantType === 'business') {
    if (input.collectionPrefix !== input.tenantId) {
      throw new ServiceError(
        'collectionPrefix deve ser igual ao tenantId para tenants business.',
        'INVALID_COLLECTION_PREFIX',
        400,
      );
    }
    return;
  }

  if (input.tenantType === 'individual') {
    if (input.collectionPrefix !== SHARED_INDIVIDUAL_COLLECTION_PREFIX) {
      throw new ServiceError(
        'collectionPrefix deve ser "compartilhado" para tenants individual.',
        'INVALID_COLLECTION_PREFIX',
        400,
      );
    }
    return;
  }

  throw new ServiceError('tenantType inválido.', 'INVALID_TENANT_TYPE', 400);
}

async function writeProvisionAudit(
  tenantId: string,
  tenantType: TenantType,
  action: string,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const dbHandle = await getDb();

  await dbHandle.collection(resolveSharedCollections().auditLogs).insertOne({
    _id: `audit_${randomUUID()}`,
    tenantId,
    companyId: tenantId,
    tenantType,
    ownerTenantId: tenantId,
    documentId: null,
    versionId: null,
    actor: {
      userId: 'system',
      name: 'DOQYN Provision',
      role: 'system',
    },
    action,
    description,
    metadata: metadata ?? {},
    createdAt: new Date(),
  } as Record<string, unknown>);
}

export async function provisionTenantEnvironment(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantOutput> {
  assertProvisionInput(input);

  await ensureRegistryTenantIndexes();

  const db = await getDb();
  const now = new Date();
  const existing = await getTenantById(input.tenantId);
  const createdCollections: string[] = [];
  const createdIndexes: string[] = [];

  const isBusiness = input.tenantType === 'business';
  const collectionPrefix = isBusiness
    ? buildBusinessCollectionPrefix(input.tenantId)
    : SHARED_INDIVIDUAL_COLLECTION_PREFIX;
  const isolationStrategy = isBusiness ? 'collection_prefix' : 'shared_individual_pool';
  const taxIdType = isBusiness ? 'CNPJ' : 'CPF';

  if (!existing) {
    const tenantDoc: Record<string, unknown> = {
      _id: `tenant_${input.tenantId}`,
      tenantId: input.tenantId,
      companyId: input.tenantId,
      tenantType: input.tenantType,
      taxIdType,
      taxIdMasked: isBusiness ? '**.***.***/****-**' : '***.***.***-**',
      taxIdHash: `provisioned_${input.tenantId}`,
      displayName: input.displayName.trim(),
      legalName: input.displayName.trim(),
      slug: slugifyName(input.displayName) || input.tenantId,
      status: 'active',
      isolation: {
        strategy: isolationStrategy,
        collectionPrefix,
        storageMode: isBusiness ? 'shared_collections' : 'shared_individual_collection',
      },
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(REGISTRY_COLLECTIONS.tenants).insertOne(tenantDoc);
  } else {
    await db
      .collection(REGISTRY_COLLECTIONS.tenants)
      .updateOne({ tenantId: input.tenantId } as Record<string, unknown>, {
        $set: {
          displayName: input.displayName.trim(),
          status: 'active',
          tenantType: input.tenantType,
          taxIdType,
          'isolation.strategy': isolationStrategy,
          'isolation.collectionPrefix': collectionPrefix,
          'isolation.storageMode': isBusiness
            ? 'shared_collections'
            : 'shared_individual_collection',
          updatedAt: now,
        },
      });
  }

  await invalidateTenantRegistryCache(input.tenantId, existing?.companyId);

  await writeProvisionAudit(
    input.tenantId,
    input.tenantType,
    'tenant.provision.started',
    'Provisionamento iniciado.',
  );

  // Provisionar tenant não cria mais coleção nem índice próprio: desde o Passo 7 todos os tenants
  // dividem o mesmo conjunto compartilhado. A chamada permanece porque o primeiro provisionamento
  // de uma instalação nova ainda precisa materializar esse conjunto — do segundo tenant em diante
  // ela não cria namespace nenhum, que é exatamente o ponto.
  const indexResults: IndexEnsureResult[] = await ensureSharedCollectionIndexes();

  for (const name of Object.values(resolveSharedCollections()).filter(Boolean) as string[]) {
    const hasCreated = indexResults.some(
      (r) => r.collection === name && (r.status === 'created' || r.name === '_collection_'),
    );
    if (hasCreated) createdCollections.push(name);
  }

  for (const result of indexResults) {
    if (result.status === 'created' && result.name !== '_collection_') {
      createdIndexes.push(`${result.collection}:${result.name}`);
    }
  }

  await writeProvisionAudit(
    input.tenantId,
    input.tenantType,
    'tenant.provision.collections_created',
    'Coleções garantidas.',
    { createdCollections: [...new Set(createdCollections)] },
  );
  await writeProvisionAudit(
    input.tenantId,
    input.tenantType,
    'tenant.provision.indexes_created',
    'Índices garantidos.',
    { createdIndexes },
  );
  await writeProvisionAudit(
    input.tenantId,
    input.tenantType,
    'tenant.provision.completed',
    'Provisionamento concluído.',
    {
      createdByUserId: input.createdByUserId,
      createdByMembershipId: input.createdByMembershipId,
    },
  );

  return {
    ok: true,
    tenantId: input.tenantId,
    tenantType: input.tenantType,
    storageMode: isBusiness ? 'shared_collections' : 'shared_individual_collection',
    collectionPrefix,
    createdCollections: [...new Set(createdCollections)],
    createdIndexes,
  };
}

export function validateCollectionPrefixForTests(prefix: string): boolean {
  if (isUnsafeCollectionPrefix(prefix)) return false;
  if (prefix === SHARED_INDIVIDUAL_COLLECTION_PREFIX) return true;
  return isSafeTenantIdentifier(prefix);
}
