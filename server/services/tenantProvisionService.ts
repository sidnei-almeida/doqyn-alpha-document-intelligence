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
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { slugifyName } from '../utils/slugify.js';
import { ensureUncategorizedCategory } from './documentCategoriesService.js';
import { ensureTenantStorageBucket } from './tenantStorageConfigService.js';
import { getR2ConfigFromEnv } from '../storage/storageConfig.js';
import { getTenantById } from './tenantsService.js';

export type ProvisionTenantInput = {
  tenantId: string;
  tenantType: TenantType;
  displayName: string;
  /** ISO 3166-1 alpha-2, como o auth validou no cadastro. Ausente = BR. */
  country?: string;
  /** Tipo do documento fiscal (`cpf`, `cnpj`, `ruc`, `ein`...). Ausente só vale para BR. */
  taxIdType?: string;
  collectionPrefix: string;
  createdByUserId: string;
  createdByMembershipId: string;
};

export type TenantTaxIdentity = {
  country: string;
  taxIdType: string;
  taxIdMasked: string;
};

const BRAZILIAN_TAX_ID_MASKS: Record<string, string> = {
  CPF: '***.***.***-**',
  CNPJ: '**.***.***/****-**',
};

/** Fora do Brasil o formato varia por país, e o app nem recebe o número: não finge um. */
const GENERIC_TAX_ID_MASK = '****';

/**
 * País, tipo e máscara do documento fiscal do tenant, a partir do que o auth mandou.
 *
 * O tipo era fixado em CNPJ/CPF pelo `tenantType`, e o `country`/`taxIdType` do corpo eram
 * descartados no handler: toda empresa de fora do Brasil ficava registrada com CNPJ e máscara
 * brasileira. Sem `country`, vale o contrato antigo (BR, tipo pelo `tenantType`).
 */
export function resolveTenantTaxIdentity(input: {
  tenantType: TenantType;
  country?: string;
  taxIdType?: string;
}): TenantTaxIdentity {
  const country = input.country?.trim().toUpperCase() || 'BR';
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new ServiceError('country inválido.', 'INVALID_COUNTRY', 400);
  }

  const brazilianDefault = input.tenantType === 'business' ? 'CNPJ' : 'CPF';
  const taxIdType =
    input.taxIdType?.trim().toUpperCase() || (country === 'BR' ? brazilianDefault : '');
  if (!/^[A-Z0-9_]{2,16}$/.test(taxIdType)) {
    throw new ServiceError('taxIdType inválido.', 'INVALID_TAX_ID_TYPE', 400);
  }

  const taxIdMasked =
    (country === 'BR' ? BRAZILIAN_TAX_ID_MASKS[taxIdType] : undefined) ?? GENERIC_TAX_ID_MASK;

  return { country, taxIdType, taxIdMasked };
}

export type ProvisionTenantOutput = {
  ok: true;
  tenantId: string;
  tenantType: TenantType;
  storageMode: TenantStorageMode;
  collectionPrefix: string;
  createdCollections: string[];
  createdIndexes: string[];
  storage: ProvisionStorageResult;
};

export type ProvisionStorageResult =
  | { ok: true; bucket: string; created: boolean; skipped: boolean }
  | { ok: false; error: string };

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

/**
 * Bucket + CORS na criação da conta.
 *
 * Falhar aqui **não** derruba o cadastro: o tenant fica com `corsStatus: 'failed'` no registry e a
 * próxima tentativa de upload reconcilia de novo. O que não pode acontecer é o oposto — cadastro
 * concluído, bucket sem política, e a API devolvendo URL assinada que o navegador rejeita em
 * silêncio. Por isso o caminho de presign recusa enquanto a CORS não estiver confirmada.
 */
async function provisionTenantStorage(
  tenantId: string,
  tenantType: TenantType,
): Promise<ProvisionStorageResult> {
  // Instalação sem R2 (storage local em desenvolvimento) não tem bucket para provisionar.
  if (!getR2ConfigFromEnv()) {
    return { ok: true, bucket: '', created: false, skipped: true };
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant não encontrado no registry após a gravação.' };
  }

  try {
    const result = await ensureTenantStorageBucket(tenant);
    logger.info('provisão: bucket e CORS garantidos', {
      tenantId,
      tenantType,
      bucket: result.bucket,
      created: result.created,
    });
    return { ok: true, bucket: result.bucket, created: result.created, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('provisão: bucket ou CORS não puderam ser garantidos', {
      tenantId,
      tenantType,
      error: message,
    });
    return { ok: false, error: message };
  }
}

export async function provisionTenantEnvironment(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantOutput> {
  assertProvisionInput(input);
  const taxIdentity = resolveTenantTaxIdentity(input);

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

  if (!existing) {
    const tenantDoc: Record<string, unknown> = {
      _id: `tenant_${input.tenantId}`,
      tenantId: input.tenantId,
      companyId: input.tenantId,
      tenantType: input.tenantType,
      country: taxIdentity.country,
      taxIdType: taxIdentity.taxIdType,
      taxIdMasked: taxIdentity.taxIdMasked,
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
          country: taxIdentity.country,
          taxIdType: taxIdentity.taxIdType,
          taxIdMasked: taxIdentity.taxIdMasked,
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

  // O bucket precisa existir com CORS antes do primeiro envio, e não durante ele: o navegador
  // faz `PUT` direto no R2 com URL assinada, então bucket sem política barra no preflight e o
  // upload morre sem nenhuma requisição chegar ao servidor. PJ ganha bucket próprio; PF divide o
  // `R2_DEFAULT_BUCKET`, que também é reconciliado aqui.
  const storageResult = await provisionTenantStorage(input.tenantId, input.tenantType);

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
  // Tenant novo nascia sem categoria nenhuma, e sem categoria o classificador não tem para onde
  // classificar: todo primeiro envio falhava e o arquivo ficava no R2 sem virar documento. Esta é a
  // pasta que garante que sempre existe um destino, mesmo antes de alguém configurar governança.
  await ensureUncategorizedCategory(input.tenantId, input.createdByUserId).catch((error) => {
    // Falha aqui não invalida o provisionamento — a categoria é recriada na primeira confirmação.
    logger.warn('provisão: não foi possível semear a categoria padrão', {
      tenantId: input.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  await writeProvisionAudit(
    input.tenantId,
    input.tenantType,
    storageResult.ok ? 'tenant.provision.storage_ready' : 'tenant.provision.storage_failed',
    storageResult.ok
      ? 'Bucket e CORS garantidos.'
      : 'Bucket ou CORS não puderam ser garantidos no cadastro.',
    storageResult.ok
      ? {
          bucket: storageResult.bucket,
          created: storageResult.created,
          skipped: storageResult.skipped,
        }
      : { error: storageResult.error },
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
    storage: storageResult,
  };
}

export function validateCollectionPrefixForTests(prefix: string): boolean {
  if (isUnsafeCollectionPrefix(prefix)) return false;
  if (prefix === SHARED_INDIVIDUAL_COLLECTION_PREFIX) return true;
  return isSafeTenantIdentifier(prefix);
}
