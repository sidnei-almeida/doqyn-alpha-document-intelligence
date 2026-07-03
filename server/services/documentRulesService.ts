import type { DocumentClassRule } from '../ai/types/documentAi.types.js';
import { DOCUMENT_CLASS_RULES } from '../ai/mocks/documentRules.mock.js';
import type {
  MongoDocumentCategory,
  MongoDocumentClass,
  MongoDocumentExtractionRule,
  MongoDocumentRule,
} from '../db/types.js';
import { getMongoDatabaseName } from '../db/database.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { countActiveAccessRules } from './documentAccessRulesService.js';
import { isAllowMockRulesEnabled } from './documentRulesConfig.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/serviceErrors.js';

export class DocumentRulesNotSeededError extends Error {
  readonly code = 'DOCUMENT_RULES_NOT_CONFIGURED';
  readonly statusCode = 503;
  readonly reason: 'governance_unavailable' | 'no_categories' | 'no_extraction_rules';

  constructor(
    message: string,
    reason: 'governance_unavailable' | 'no_categories' | 'no_extraction_rules' = 'no_categories',
  ) {
    super(message);
    this.name = 'DocumentRulesNotSeededError';
    this.reason = reason;
  }
}

export type DocumentRulesLoadResult = {
  rules: DocumentClassRule[];
  source: 'mongodb' | 'mock';
  companyId: string;
  database: string;
  collectionsConsulted: string[];
  activeCategoriesCount: number;
  activeExtractionRulesCount: number;
  activeAccessRulesCount: number;
  usedMockFallback: boolean;
  mockFallbackReason?: string;
};

export type ClassRuleDiagnostics = {
  companyId: string;
  classId: string;
  className: string | null;
  database: string;
  documentClassFound: boolean;
  documentRuleFound: boolean;
  activeClassesCount: number;
  activeRulesCount: number;
};

function mapToDocumentClassRule(
  category: MongoDocumentCategory | MongoDocumentClass,
  rule: MongoDocumentExtractionRule | MongoDocumentRule,
): DocumentClassRule {
  return {
    id: category._id,
    name: category.name,
    description: category.description,
    keywords: category.keywords,
    negativeKeywords: category.negativeKeywords,
    fields: rule.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      description: field.description,
      aliases: field.aliases,
      examples: field.examples,
    })),
    namingTemplate: rule.namingTemplate,
  };
}

export function mapCategoryExtractionRules(
  categories: Array<MongoDocumentCategory | MongoDocumentClass>,
  extractionRules: Array<MongoDocumentExtractionRule | MongoDocumentRule>,
): DocumentClassRule[] {
  const latestRuleByCategory = new Map<string, MongoDocumentExtractionRule | MongoDocumentRule>();
  for (const rule of extractionRules) {
    const categoryId = 'categoryId' in rule ? rule.categoryId : rule.classId;
    if (!latestRuleByCategory.has(categoryId)) {
      latestRuleByCategory.set(categoryId, rule);
    }
  }

  return categories
    .map((category) => {
      const rule = latestRuleByCategory.get(category._id);
      if (!rule) return null;
      return mapToDocumentClassRule(category, rule);
    })
    .filter((item): item is DocumentClassRule => Boolean(item));
}

async function loadFromGovernanceCollections(
  tenantId: string,
  opts?: { ownerUserId?: string },
) {
  const collections = await getTenantCollections(tenantId, { userId: opts?.ownerUserId });
  if (
    !collections.documentCategories ||
    !collections.documentExtractionRules ||
    !collections.documentRules
  ) {
    return null;
  }

  const scope = buildClassRuleOwnershipFilter(collections.storage);
  const categories = await collections.documentCategories
    .find({ ...scope, active: true })
    .toArray();

  const extractionRules = await collections.documentExtractionRules
    .find({ ...scope, active: true })
    .sort({ categoryId: 1, version: -1 })
    .toArray();

  const activeAccessRulesCount = await countActiveAccessRules(tenantId, {
    ownerUserId: opts?.ownerUserId,
  });

  return {
    categories: categories as MongoDocumentCategory[],
    extractionRules: extractionRules as MongoDocumentExtractionRule[],
    activeAccessRulesCount,
  };
}

async function loadFromLegacyCollections(tenantId: string, opts?: { ownerUserId?: string }) {
  const collections = await getTenantCollections(tenantId, { userId: opts?.ownerUserId });
  if (!collections.documentClasses) return null;

  const scope = buildClassRuleOwnershipFilter(collections.storage);
  const categories = await collections.documentClasses
    .find({ ...scope, active: true })
    .toArray();

  const legacyRulesCollectionName = collections.names.documentRules?.replace(
    'document_rules',
    'document_extraction_rules',
  );

  let extractionRules: MongoDocumentRule[] = [];
  if (legacyRulesCollectionName && collections.names.documentClasses) {
    const db = (await import('../db/mongoClient.js')).getDb;
    const dbHandle = await db();
    const legacyExtraction = await dbHandle
      .collection<MongoDocumentRule>(legacyRulesCollectionName)
      .find({ ...scope, active: true })
      .sort({ classId: 1, version: -1 })
      .toArray();
    extractionRules = legacyExtraction;
  }

  if (!extractionRules.length && collections.names.documentClasses) {
    const db = (await import('../db/mongoClient.js')).getDb;
    const dbHandle = await db();
    const oldRulesName = collections.names.documentClasses.replace(
      'document_classes',
      'document_rules',
    );
    extractionRules = await dbHandle
      .collection<MongoDocumentRule>(oldRulesName)
      .find({ ...scope, active: true })
      .sort({ classId: 1, version: -1 })
      .toArray();
  }

  return {
    categories: categories as MongoDocumentClass[],
    extractionRules,
    activeAccessRulesCount: categories.some((c) =>
      Object.values((c as MongoDocumentClass).permissions ?? {}).some(
        (ids) => Array.isArray(ids) && ids.length > 0,
      ),
    )
      ? 1
      : 0,
  };
}

export async function loadActiveDocumentClassRules(
  companyId: string,
  opts?: { ownerUserId?: string },
): Promise<DocumentRulesLoadResult> {
  const tenantId = companyId?.trim();
  if (!tenantId) {
    throw new ServiceError('Não foi possível identificar a empresa/tenant ativo da sessão.', 'TENANT_REQUIRED', 400);
  }

  const database = getMongoDatabaseName();

  if (!isMongoNativeConfigured()) {
    if (isAllowMockRulesEnabled()) {
      logger.warn('ALLOW_MOCK_RULES=true: usando catálogo mock em desenvolvimento.', {
        companyId: tenantId,
        database,
        mockClassesCount: DOCUMENT_CLASS_RULES.length,
      } as Record<string, unknown>);

      return {
        rules: DOCUMENT_CLASS_RULES,
        source: 'mock',
        companyId: tenantId,
        database,
        collectionsConsulted: [],
        activeCategoriesCount: DOCUMENT_CLASS_RULES.length,
        activeExtractionRulesCount: DOCUMENT_CLASS_RULES.length,
        activeAccessRulesCount: DOCUMENT_CLASS_RULES.length,
        usedMockFallback: true,
        mockFallbackReason: 'allow_mock_rules',
      };
    }

    throw new ServiceError(
      'O armazenamento de regras documentais não está configurado.',
      'MONGODB_NOT_CONFIGURED',
      503,
    );
  }

  const governance = await loadFromGovernanceCollections(tenantId, opts);
  const loaded =
    governance && governance.categories.length > 0
      ? governance
      : await loadFromLegacyCollections(tenantId, opts);

  if (!loaded) {
    throw new DocumentRulesNotSeededError(
      'Governança documental não disponível para este tipo de cliente.',
      'governance_unavailable',
    );
  }

  const mapped = mapCategoryExtractionRules(loaded.categories, loaded.extractionRules);
  const activeCategoriesCount = loaded.categories.length;
  const activeExtractionRulesCount = loaded.extractionRules.length;
  const activeAccessRulesCount = loaded.activeAccessRulesCount;

  const collections = await getTenantCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  const collectionsConsulted = [
    collections.names.documentCategories,
    collections.names.documentExtractionRules,
    collections.names.documentRules,
  ].filter(Boolean) as string[];

  if (!activeCategoriesCount) {
    logger.error('Categorias documentais ausentes no MongoDB.', {
      companyId: tenantId,
      database,
      activeCategoriesCount,
      activeExtractionRulesCount,
      activeAccessRulesCount,
      mappedRulesCount: mapped.length,
      collectionsConsulted,
    } as Record<string, unknown>);

    throw new DocumentRulesNotSeededError(
      'Nenhuma categoria documental ativa encontrada para esta empresa.',
      'no_categories',
    );
  }

  if (!mapped.length || !activeExtractionRulesCount) {
    logger.error('Regras de extração/classificação ausentes no MongoDB.', {
      companyId: tenantId,
      database,
      activeCategoriesCount,
      activeExtractionRulesCount,
      activeAccessRulesCount,
      mappedRulesCount: mapped.length,
      collectionsConsulted,
    } as Record<string, unknown>);

    throw new DocumentRulesNotSeededError(
      'Nenhuma regra de classificação/extração ativa encontrada para as categorias desta empresa.',
      'no_extraction_rules',
    );
  }

  if (!activeAccessRulesCount) {
    logger.warn('Matriz de acesso vazia — análise permitida, conexões podem estar pendentes no mapa.', {
      companyId: tenantId,
      database,
      activeCategoriesCount,
      activeExtractionRulesCount,
      activeAccessRulesCount,
      mappedRulesCount: mapped.length,
      collectionsConsulted,
    } as Record<string, unknown>);
  }

  return {
    rules: mapped,
    source: 'mongodb',
    companyId: tenantId,
    database,
    collectionsConsulted,
    activeCategoriesCount,
    activeExtractionRulesCount,
    activeAccessRulesCount,
    usedMockFallback: false,
  };
}

export async function getActiveDocumentClassRules(
  companyId: string,
  opts?: { ownerUserId?: string },
): Promise<DocumentClassRule[]> {
  const loaded = await loadActiveDocumentClassRules(companyId, opts);
  return loaded.rules;
}

export async function getActiveRulesPayload(
  companyId: string,
  opts?: { ownerUserId?: string },
) {
  const tenantId = companyId?.trim();
  if (!tenantId) {
    throw new ServiceError('Não foi possível identificar a empresa/tenant ativo da sessão.', 'TENANT_REQUIRED', 400);
  }

  if (!isMongoNativeConfigured()) {
    if (isAllowMockRulesEnabled()) {
      return {
        companyId: tenantId,
        database: getMongoDatabaseName(),
        source: 'mock' as const,
        activeClassesCount: DOCUMENT_CLASS_RULES.length,
        activeRulesCount: DOCUMENT_CLASS_RULES.length,
        classes: DOCUMENT_CLASS_RULES,
      };
    }

    throw new ServiceError(
      'O armazenamento de regras documentais não está configurado.',
      'MONGODB_NOT_CONFIGURED',
      503,
    );
  }

  try {
    const loaded = await loadActiveDocumentClassRules(tenantId, opts);
    return {
      companyId: tenantId,
      database: getMongoDatabaseName(),
      source: 'mongodb' as const,
      activeClassesCount: loaded.activeCategoriesCount,
      activeRulesCount: loaded.activeExtractionRulesCount,
      activeAccessRulesCount: loaded.activeAccessRulesCount,
      classes: loaded.rules,
    };
  } catch {
    return {
      companyId: tenantId,
      database: getMongoDatabaseName(),
      source: 'empty' as const,
      activeClassesCount: 0,
      activeRulesCount: 0,
      setupHint: 'Configure categorias, grupos e regras de acesso em /rules.',
      classes: [],
    };
  }
}

export async function diagnoseClassAndRuleLookup(input: {
  companyId: string;
  classId: string;
  className?: string | null;
  ownerUserId?: string;
}): Promise<ClassRuleDiagnostics> {
  const tenantId = input.companyId;
  const database = getMongoDatabaseName();

  if (!isMongoNativeConfigured()) {
    return {
      companyId: tenantId,
      classId: input.classId,
      className: input.className ?? null,
      database,
      documentClassFound: false,
      documentRuleFound: false,
      activeClassesCount: 0,
      activeRulesCount: 0,
    };
  }

  const governance = await loadFromGovernanceCollections(tenantId, { ownerUserId: input.ownerUserId });
  if (!governance) {
    return {
      companyId: tenantId,
      classId: input.classId,
      className: input.className ?? null,
      database,
      documentClassFound: false,
      documentRuleFound: false,
      activeClassesCount: 0,
      activeRulesCount: 0,
    };
  }

  const category = governance.categories.find((c) => c._id === input.classId);
  const rule = governance.extractionRules.find((r) => r.categoryId === input.classId);

  return {
    companyId: tenantId,
    classId: input.classId,
    className: input.className ?? category?.name ?? null,
    database,
    documentClassFound: Boolean(category),
    documentRuleFound: Boolean(rule),
    activeClassesCount: governance.categories.length,
    activeRulesCount: governance.extractionRules.length,
  };
}

export async function getMongoClassAndRule(input: {
  companyId: string;
  classId: string;
  ownerUserId?: string;
}): Promise<{
  docClass: MongoDocumentCategory | MongoDocumentClass;
  rule: MongoDocumentExtractionRule | MongoDocumentRule;
} | null> {
  const governance = await loadFromGovernanceCollections(input.companyId, {
    ownerUserId: input.ownerUserId,
  });

  if (governance) {
    const docClass = governance.categories.find((c) => c._id === input.classId && c.active);
    const rule = governance.extractionRules.find((r) => r.categoryId === input.classId && r.active);
    if (docClass && rule) return { docClass, rule };
  }

  const legacy = await loadFromLegacyCollections(input.companyId, { ownerUserId: input.ownerUserId });
  if (!legacy) return null;

  const docClass = legacy.categories.find((c) => c._id === input.classId && c.active);
  const rule = legacy.extractionRules.find((r) => r.classId === input.classId && r.active);
  if (!docClass || !rule) return null;

  return { docClass, rule };
}

export function getDocumentClassRuleById(
  classes: DocumentClassRule[],
  classId: string,
): DocumentClassRule | undefined {
  return classes.find((item) => item.id === classId);
}

export function isDocumentRulesNotSeededError(
  error: unknown,
): error is DocumentRulesNotSeededError {
  return error instanceof DocumentRulesNotSeededError;
}
