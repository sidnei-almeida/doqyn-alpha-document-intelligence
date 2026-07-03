import 'dotenv/config';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import type { MongoTenant } from '../server/db/types.js';
import { loadActiveDocumentClassRules } from '../server/services/documentRulesService.js';
import { isAllowMockRulesEnabled } from '../server/services/documentRulesConfig.js';
import {
  buildGovernanceAuditTargets,
  deriveAnalysisReady,
  formatTenantNotFoundMessage,
  inferCollectionPrefixesFromDb,
  parseGovernanceAuditTenantArg,
  safeResolveTenantCollectionNames,
  sanitizeGovernanceDocumentSample,
  type GovernanceAuditTarget,
} from '../server/tenancy/governanceAudit.js';
import type { ResolvedTenantCollectionNames } from '../server/tenancy/tenantResolver.js';

type GovernanceIntegrity = {
  scopeGlobalCategories: number;
  scopeGlobalExtractionRules: number;
  orphanedCategories: number;
  orphanedExtractionRules: number;
  pipelineIgnoresScopeGlobal: boolean;
};

type TenantGovernanceAudit = {
  tenantId: string;
  tenantType?: string;
  status?: string;
  source: GovernanceAuditTarget['source'];
  pfAuditNote?: string;
  collectionPrefix?: string;
  resolutionError?: string;
  resolutionErrorCode?: string;
  collections: {
    documentCategories?: string;
    documentGroups?: string;
    documentGroupMembers?: string;
    documentRules?: string;
    documentExtractionRules?: string;
  };
  counts: {
    documentCategories: number;
    documentGroups: number;
    documentRulesActive: number;
    documentExtractionRulesActive: number;
  };
  integrity: GovernanceIntegrity;
  analysisReady: boolean;
  analysisReadyReasons: string[];
  analysisPipeline?: {
    activeCategoriesCount: number;
    activeExtractionRulesCount: number;
    activeAccessRulesCount: number;
    mappedRulesCount: number;
    collectionsConsulted: string[];
    source: string;
  };
  analysisError?: string;
  analysisErrorCode?: string;
  debugSamples?: {
    documentCategory?: Record<string, unknown> | null;
    documentExtractionRule?: Record<string, unknown> | null;
    documentAccessRule?: Record<string, unknown> | null;
  };
};

const EMPTY_INTEGRITY: GovernanceIntegrity = {
  scopeGlobalCategories: 0,
  scopeGlobalExtractionRules: 0,
  orphanedCategories: 0,
  orphanedExtractionRules: 0,
  pipelineIgnoresScopeGlobal: true,
};

async function countActive(
  collectionName: string | undefined,
  tenantId: string,
  activeOnly = false,
): Promise<number> {
  if (!collectionName) return 0;
  const db = await getDb();
  const filter: Record<string, unknown> = {
    $or: [{ tenantId }, { companyId: tenantId }],
  };
  if (activeOnly) filter.active = true;
  return db.collection(collectionName).countDocuments(filter);
}

async function countInCollection(
  collectionName: string | undefined,
  filter: Record<string, unknown>,
): Promise<number> {
  if (!collectionName) return 0;
  const db = await getDb();
  return db.collection(collectionName).countDocuments(filter);
}

async function fetchGovernanceDebugSamples(
  names: ResolvedTenantCollectionNames,
  tenantId: string,
): Promise<TenantGovernanceAudit['debugSamples']> {
  const db = await getDb();
  const tenantScope = {
    $or: [{ tenantId }, { companyId: tenantId }],
    active: true,
  };

  const [category, extractionRule, accessRule] = await Promise.all([
    names.documentCategories
      ? db.collection(names.documentCategories).findOne(tenantScope)
      : Promise.resolve(null),
    names.documentExtractionRules
      ? db.collection(names.documentExtractionRules).findOne(tenantScope)
      : Promise.resolve(null),
    names.documentRules
      ? db.collection(names.documentRules).findOne(tenantScope)
      : Promise.resolve(null),
  ]);

  return {
    documentCategory: sanitizeGovernanceDocumentSample(
      category as Record<string, unknown> | null | undefined,
    ),
    documentExtractionRule: sanitizeGovernanceDocumentSample(
      extractionRule as Record<string, unknown> | null | undefined,
    ),
    documentAccessRule: sanitizeGovernanceDocumentSample(
      accessRule as Record<string, unknown> | null | undefined,
    ),
  };
}

function shouldIncludeGovernanceDebugSamples(): boolean {
  if (process.env.DEMO_GOVERNANCE_AUDIT_DEBUG === 'true') return true;
  return process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'production';
}

async function auditIntegrity(names: ResolvedTenantCollectionNames): Promise<GovernanceIntegrity> {
  const scopeGlobalCategories = await countInCollection(names.documentCategories, {
    scope: 'global',
  });
  const scopeGlobalExtractionRules = await countInCollection(names.documentExtractionRules, {
    scope: 'global',
  });

  const orphanedCategories = await countInCollection(names.documentCategories, {
    $and: [
      { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }] },
      { $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }] },
      { $or: [{ ownerTenantId: { $exists: false } }, { ownerTenantId: null }, { ownerTenantId: '' }] },
    ],
  });

  const orphanedExtractionRules = await countInCollection(names.documentExtractionRules, {
    $and: [
      { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }] },
      { $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }] },
      { $or: [{ ownerTenantId: { $exists: false } }, { ownerTenantId: null }, { ownerTenantId: '' }] },
    ],
  });

  return {
    scopeGlobalCategories,
    scopeGlobalExtractionRules,
    orphanedCategories,
    orphanedExtractionRules,
    pipelineIgnoresScopeGlobal: true,
  };
}

async function auditTarget(target: GovernanceAuditTarget): Promise<TenantGovernanceAudit> {
  const auditTenantId = target.tenantId.startsWith('shared:')
    ? target.collectionPrefix ?? target.tenantId.replace(/^shared:/, '')
    : target.tenantId;

  const tenantForResolve: Partial<MongoTenant> & { tenantId: string } = {
    tenantId: auditTenantId,
    tenantType: target.tenantType === 'unknown' ? undefined : target.tenantType,
    status: target.status as MongoTenant['status'] | undefined,
    isolation: target.collectionPrefix
      ? {
          strategy:
            target.tenantType === 'individual' ? 'shared_individual_pool' : 'collection_prefix',
          collectionPrefix: target.collectionPrefix,
        }
      : undefined,
  };

  const resolved = safeResolveTenantCollectionNames(tenantForResolve);

  const summary: TenantGovernanceAudit = {
    tenantId: target.tenantId,
    tenantType: target.tenantType,
    status: target.status,
    source: target.source,
    pfAuditNote: target.pfAuditNote,
    collectionPrefix: resolved.ok ? resolved.collectionPrefix : target.collectionPrefix,
    resolutionError: resolved.ok ? undefined : resolved.error,
    resolutionErrorCode: resolved.ok ? undefined : resolved.code,
    collections: resolved.ok
      ? {
          documentCategories: resolved.names.documentCategories,
          documentGroups: resolved.names.documentGroups,
          documentGroupMembers: resolved.names.documentGroupMembers,
          documentRules: resolved.names.documentRules,
          documentExtractionRules: resolved.names.documentExtractionRules,
        }
      : {},
    counts: {
      documentCategories: 0,
      documentGroups: 0,
      documentRulesActive: 0,
      documentExtractionRulesActive: 0,
    },
    integrity: EMPTY_INTEGRITY,
    analysisReady: false,
    analysisReadyReasons: [],
  };

  if (!resolved.ok) {
    const readiness = deriveAnalysisReady({
      resolutionError: resolved.error,
      activeCategoriesCount: 0,
      activeExtractionRulesCount: 0,
    });
    summary.analysisReady = readiness.ready;
    summary.analysisReadyReasons = readiness.reasons;
    return summary;
  }

  const filterTenantId = target.tenantId.startsWith('shared:')
    ? undefined
    : target.tenantId;

  summary.counts = {
    documentCategories: filterTenantId
      ? await countActive(resolved.names.documentCategories, filterTenantId, true)
      : await countInCollection(resolved.names.documentCategories, { active: true }),
    documentGroups: filterTenantId
      ? await countActive(resolved.names.documentGroups, filterTenantId, true)
      : await countInCollection(resolved.names.documentGroups, { active: true }),
    documentRulesActive: filterTenantId
      ? await countActive(resolved.names.documentRules, filterTenantId, true)
      : await countInCollection(resolved.names.documentRules, { active: true }),
    documentExtractionRulesActive: filterTenantId
      ? await countActive(resolved.names.documentExtractionRules, filterTenantId, true)
      : await countInCollection(resolved.names.documentExtractionRules, { active: true }),
  };
  summary.integrity = await auditIntegrity(resolved.names);

  if (shouldIncludeGovernanceDebugSamples() && filterTenantId) {
    summary.debugSamples = await fetchGovernanceDebugSamples(resolved.names, filterTenantId);
  }

  const pipelineTenantId = target.tenantId.startsWith('shared:') ? undefined : target.tenantId;

  if (pipelineTenantId) {
    try {
      const loaded = await loadActiveDocumentClassRules(pipelineTenantId);
      summary.analysisPipeline = {
        activeCategoriesCount: loaded.activeCategoriesCount,
        activeExtractionRulesCount: loaded.activeExtractionRulesCount,
        activeAccessRulesCount: loaded.activeAccessRulesCount,
        mappedRulesCount: loaded.rules.length,
        collectionsConsulted: loaded.collectionsConsulted,
        source: loaded.source,
      };

      const readiness = deriveAnalysisReady({
        activeCategoriesCount: loaded.activeCategoriesCount,
        activeExtractionRulesCount: loaded.activeExtractionRulesCount,
      });
      summary.analysisReady = readiness.ready;
      summary.analysisReadyReasons = readiness.reasons;
    } catch (error) {
      summary.analysisError = error instanceof Error ? error.message : String(error);
      summary.analysisErrorCode =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : undefined;

      const readiness = deriveAnalysisReady({
        analysisError: summary.analysisError,
        activeCategoriesCount: summary.counts.documentCategories,
        activeExtractionRulesCount: summary.counts.documentExtractionRulesActive,
      });
      summary.analysisReady = readiness.ready;
      summary.analysisReadyReasons = readiness.reasons;
    }
  } else {
    const readiness = deriveAnalysisReady({
      activeCategoriesCount: summary.counts.documentCategories,
      activeExtractionRulesCount: summary.counts.documentExtractionRulesActive,
    });
    summary.analysisReady = readiness.ready;
    summary.analysisReadyReasons = readiness.reasons;
    if (target.pfAuditNote) {
      summary.analysisReadyReasons.push(target.pfAuditNote);
    }
  }

  return summary;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurado.');
    process.exit(1);
  }

  const tenantArg = parseGovernanceAuditTenantArg(process.argv);
  const db = await getDb();
  const dbCollectionNames = (await db.listCollections().toArray()).map((entry) => entry.name);
  const inferredPrefixes = inferCollectionPrefixesFromDb(dbCollectionNames);

  const registryTenants = (await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .find({}, { projection: { tenantId: 1, tenantType: 1, status: 1, isolation: 1 } })
    .sort({ tenantId: 1 })
    .toArray()) as MongoTenant[];

  if (tenantArg) {
    const inRegistry = registryTenants.some((tenant) => tenant.tenantId === tenantArg);
    const inCollections = inferredPrefixes.includes(tenantArg);
    if (!inRegistry && !inCollections) {
      console.error(formatTenantNotFoundMessage(tenantArg, inferredPrefixes));
      await closeMongoConnection();
      process.exit(1);
    }
  }

  const targets = buildGovernanceAuditTargets({
    registryTenants,
    dbCollectionNames,
    tenantFilter: tenantArg,
  });

  if (targets.length === 0) {
    console.error(
      'Nenhum tenant ou collection de governança encontrado. Crie tenants ou collections document_categories_* no Mongo.',
    );
    if (inferredPrefixes.length > 0) {
      console.error(`Prefixos inferidos: ${inferredPrefixes.join(', ')}`);
    }
    await closeMongoConnection();
    process.exit(1);
  }

  const audits: TenantGovernanceAudit[] = [];
  for (const target of targets) {
    try {
      audits.push(await auditTarget(target));
    } catch (error) {
      audits.push({
        tenantId: target.tenantId,
        tenantType: target.tenantType,
        status: target.status,
        source: target.source,
        pfAuditNote: target.pfAuditNote,
        collections: {},
        counts: {
          documentCategories: 0,
          documentGroups: 0,
          documentRulesActive: 0,
          documentExtractionRulesActive: 0,
        },
        integrity: EMPTY_INTEGRITY,
        analysisReady: false,
        analysisReadyReasons: [
          error instanceof Error ? error.message : String(error),
        ],
        resolutionError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    database: db.databaseName,
    tenantFilter: tenantArg ?? null,
    discoveredCollectionPrefixes: inferredPrefixes,
    registryTenantCount: registryTenants.length,
    auditedTenantCount: audits.length,
    mockRulesFlagEnabled: isAllowMockRulesEnabled(),
    tenants: audits,
    notes: [
      'document_rules = matriz de acesso categoria ↔ grupo (não bloqueia análise se vazia).',
      'document_extraction_rules = regras de classificação/extração exigidas pelo pipeline.',
      'Registros scope:global existentes no Mongo NÃO são usados pelo pipeline real (filtro tenant-only).',
      'Conexões no mapa /rules só entram em document_rules após Salvar alterações.',
      'Tenants individual/PF usam collections compartilhadas — auditoria PF é parcial sem ownerUserId.',
      'Tenants sem isolation no registry são normalizados com collectionPrefix=tenantId (business) ou compartilhado (PF).',
      'Nenhum dado sensível (CPF/CNPJ/tokens/conteúdo) é exibido por este relatório.',
      'Nenhum dado foi alterado por este relatório.',
    ],
  };

  console.log(JSON.stringify(report, null, 2));
  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
