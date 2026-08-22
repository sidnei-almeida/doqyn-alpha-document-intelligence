import { COLLECTIONS } from '../db/constants.js';
import type { MongoTenant, TenantIsolationStrategy, TenantType } from '../db/types.js';
import { resolveSharedCollections, type ResolvedTenantCollectionNames } from './tenantResolver.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from './taxId.js';
import { ServiceError } from '../utils/serviceErrors.js';

export const GOVERNANCE_COLLECTION_BASES = [
  COLLECTIONS.documentCategories,
  COLLECTIONS.documentExtractionRules,
  COLLECTIONS.documentRules,
] as const;

export type GovernanceAuditTarget = {
  tenantId: string;
  tenantType?: TenantType | 'unknown';
  status?: string;
  collectionPrefix?: string;
  source: 'registry' | 'inferred_collections';
  pfAuditNote?: string;
};

export type SafeResolvedCollections =
  | { ok: true; names: ResolvedTenantCollectionNames; collectionPrefix: string }
  | { ok: false; error: string; code?: string };

export function inferCollectionPrefixesFromDb(collectionNames: string[]): string[] {
  const prefixes = new Set<string>();

  for (const name of collectionNames) {
    for (const base of GOVERNANCE_COLLECTION_BASES) {
      const marker = `${base}_`;
      if (name.startsWith(marker)) {
        prefixes.add(name.slice(marker.length));
      }
    }
  }

  return [...prefixes].sort();
}

function defaultIsolationForTenant(
  tenantId: string,
  tenantType: TenantType,
): { strategy: TenantIsolationStrategy; collectionPrefix: string } {
  if (tenantType === 'individual') {
    return {
      strategy: 'shared_individual_pool',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    };
  }

  return {
    strategy: 'collection_prefix',
    collectionPrefix: tenantId,
  };
}

export function normalizeTenantForAudit(
  tenant: Partial<MongoTenant> & { tenantId: string },
): MongoTenant {
  const tenantType = tenant.tenantType ?? 'business';
  const fallback = defaultIsolationForTenant(tenant.tenantId, tenantType);
  const isolation = tenant.isolation;

  return {
    ...(tenant as MongoTenant),
    tenantId: tenant.tenantId,
    tenantType,
    isolation: {
      strategy: isolation?.strategy ?? fallback.strategy,
      collectionPrefix: isolation?.collectionPrefix?.trim() || fallback.collectionPrefix,
    },
  };
}

export function safeResolveTenantCollectionNames(
  tenant: Partial<MongoTenant> & { tenantId: string },
): SafeResolvedCollections {
  if (!tenant.tenantId?.trim()) {
    return {
      ok: false,
      error: 'tenantId ausente — não é possível resolver collections.',
      code: 'TENANT_ID_MISSING',
    };
  }

  try {
    const normalized = normalizeTenantForAudit(tenant);
    if (!normalized.isolation?.collectionPrefix?.trim()) {
      return {
        ok: false,
        error: 'collectionPrefix indefinido após normalização do tenant.',
        code: 'COLLECTION_PREFIX_MISSING',
      };
    }

    const names = resolveSharedCollections();
    return {
      ok: true,
      names,
      collectionPrefix: normalized.isolation.collectionPrefix,
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { ok: false, error: error.message, code: error.code };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'TENANT_RESOLUTION_FAILED',
    };
  }
}

function buildPfAuditNote(tenantType?: TenantType | 'unknown'): string | undefined {
  if (tenantType === 'individual') {
    return 'PF/shared audit: parcial — collections compartilhadas; contagem filtrada por tenantId.';
  }
  return undefined;
}

export function buildGovernanceAuditTargets(input: {
  registryTenants: Array<Partial<MongoTenant> & { tenantId: string }>;
  dbCollectionNames: string[];
  tenantFilter?: string;
}): GovernanceAuditTarget[] {
  const inferredPrefixes = inferCollectionPrefixesFromDb(input.dbCollectionNames);
  const registryById = new Map(input.registryTenants.map((tenant) => [tenant.tenantId, tenant]));

  if (input.tenantFilter) {
    const registryTenant = registryById.get(input.tenantFilter);
    if (registryTenant) {
      return [
        {
          tenantId: registryTenant.tenantId,
          tenantType: registryTenant.tenantType,
          status: registryTenant.status,
          collectionPrefix: registryTenant.isolation?.collectionPrefix,
          source: 'registry',
          pfAuditNote: buildPfAuditNote(registryTenant.tenantType),
        },
      ];
    }

    const inferredMatch = inferredPrefixes.includes(input.tenantFilter);
    return [
      {
        tenantId: input.tenantFilter,
        tenantType:
          inferredMatch && input.tenantFilter === SHARED_INDIVIDUAL_COLLECTION_PREFIX
            ? 'individual'
            : 'unknown',
        source: inferredMatch ? 'inferred_collections' : 'registry',
        collectionPrefix: inferredMatch ? input.tenantFilter : undefined,
        pfAuditNote:
          input.tenantFilter === SHARED_INDIVIDUAL_COLLECTION_PREFIX
            ? 'PF/shared audit: parcial — tenantId não encontrado no registry; collections inferidas.'
            : undefined,
      },
    ];
  }

  const targets = new Map<string, GovernanceAuditTarget>();

  for (const tenant of input.registryTenants) {
    targets.set(tenant.tenantId, {
      tenantId: tenant.tenantId,
      tenantType: tenant.tenantType,
      status: tenant.status,
      collectionPrefix: tenant.isolation?.collectionPrefix,
      source: 'registry',
      pfAuditNote: buildPfAuditNote(tenant.tenantType),
    });
  }

  for (const prefix of inferredPrefixes) {
    const existingRegistryTenant = [...registryById.values()].find((tenant) => {
      const normalized = normalizeTenantForAudit(tenant);
      return normalized.isolation.collectionPrefix === prefix;
    });

    if (existingRegistryTenant) {
      continue;
    }

    const syntheticId =
      prefix === SHARED_INDIVIDUAL_COLLECTION_PREFIX
        ? `shared:${SHARED_INDIVIDUAL_COLLECTION_PREFIX}`
        : prefix;

    if (!targets.has(syntheticId)) {
      targets.set(syntheticId, {
        tenantId: syntheticId,
        tenantType: prefix === SHARED_INDIVIDUAL_COLLECTION_PREFIX ? 'individual' : 'unknown',
        source: 'inferred_collections',
        collectionPrefix: prefix,
        pfAuditNote:
          prefix === SHARED_INDIVIDUAL_COLLECTION_PREFIX
            ? 'PF/shared audit: parcial — collections inferidas sem tenant no registry.'
            : undefined,
      });
    }
  }

  return [...targets.values()].sort((a, b) => a.tenantId.localeCompare(b.tenantId));
}

export function deriveAnalysisReady(input: {
  resolutionError?: string;
  analysisError?: string;
  activeCategoriesCount: number;
  activeExtractionRulesCount: number;
  mappedRulesCount?: number;
}): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (input.resolutionError) {
    reasons.push(input.resolutionError);
  }
  if (input.analysisError) {
    reasons.push(input.analysisError);
  }
  if (input.activeCategoriesCount === 0) {
    reasons.push('Sem categorias ativas.');
  }
  if (input.activeExtractionRulesCount === 0) {
    reasons.push('Sem regras de extração ativas.');
  }

  return { ready: reasons.length === 0, reasons };
}

const GOVERNANCE_SAMPLE_KEYS = [
  '_id',
  'tenantId',
  'companyId',
  'tenantType',
  'ownerTenantId',
  'active',
  'categoryId',
  'classId',
  'groupId',
  'scope',
  'version',
] as const;

export function sanitizeGovernanceDocumentSample(
  doc: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!doc) return null;

  const sample: Record<string, unknown> = {};
  for (const key of GOVERNANCE_SAMPLE_KEYS) {
    if (key in doc) sample[key] = doc[key];
  }

  if (typeof doc.name === 'string') {
    sample.name = doc.name;
  }

  if (Array.isArray(doc.fields)) {
    sample.fieldKeys = doc.fields
      .map((field) =>
        field && typeof field === 'object' ? (field as { key?: string }).key : undefined,
      )
      .filter((key): key is string => typeof key === 'string' && key.length > 0);
  }

  return sample;
}

export function parseGovernanceAuditTenantArg(argv: string[]): string | undefined {
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]?.trim();
    if (!arg) continue;

    if (arg === '--tenant') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new Error('Flag --tenant requer um valor (ex.: --tenant company_alpha_consultoria).');
      }
      index += 1;
      return value;
    }

    if (arg.startsWith('--tenant=')) {
      const value = arg.slice('--tenant='.length).trim();
      if (!value) {
        throw new Error(
          'Flag --tenant= requer um valor (ex.: --tenant=company_alpha_consultoria).',
        );
      }
      return value;
    }

    if (!arg.startsWith('-')) {
      return arg;
    }
  }

  return undefined;
}

export function formatTenantNotFoundMessage(tenantId: string, inferredPrefixes: string[]): string {
  const examples = inferredPrefixes.slice(0, 8);
  const suffix =
    examples.length > 0
      ? ` Exemplos de prefixos/collections encontrados: ${examples.join(', ')}.`
      : ' Nenhuma collection document_categories_* encontrada no banco.';
  return `Tenant não encontrado no registry: ${tenantId}.${suffix}`;
}
