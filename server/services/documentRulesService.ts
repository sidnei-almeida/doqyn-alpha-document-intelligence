import type { DocumentClassRule } from '../ai/types/documentAi.types.js';
import { DOCUMENT_CLASS_RULES } from '../ai/mocks/documentRules.mock.js';
import { DEV_TENANT_ID } from '../db/constants.js';
import type { MongoDocumentClass, MongoDocumentRule } from '../db/types.js';
import { getMongoDatabaseName } from '../db/database.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { logger } from '../utils/logger.js';

export class DocumentRulesNotSeededError extends Error {
  readonly code = 'RULES_NOT_SEEDED';
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'DocumentRulesNotSeededError';
  }
}

export type DocumentRulesLoadResult = {
  rules: DocumentClassRule[];
  source: 'mongodb' | 'mock';
  companyId: string;
  database: string;
  activeClassesCount: number;
  activeRulesCount: number;
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

function mapMongoToDocumentClassRule(
  docClass: MongoDocumentClass,
  rule: MongoDocumentRule,
): DocumentClassRule {
  return {
    id: docClass._id,
    name: docClass.name,
    description: docClass.description,
    keywords: docClass.keywords,
    negativeKeywords: docClass.negativeKeywords,
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

function mapMongoRules(
  classes: MongoDocumentClass[],
  rules: MongoDocumentRule[],
): DocumentClassRule[] {
  const latestRuleByClass = new Map<string, MongoDocumentRule>();
  for (const rule of rules) {
    if (!latestRuleByClass.has(rule.classId)) {
      latestRuleByClass.set(rule.classId, rule);
    }
  }

  return classes
    .map((docClass) => {
      const rule = latestRuleByClass.get(docClass._id);
      if (!rule) return null;
      return mapMongoToDocumentClassRule(docClass, rule);
    })
    .filter((item): item is DocumentClassRule => Boolean(item));
}

export async function loadActiveDocumentClassRules(
  companyId: string = DEV_TENANT_ID,
  opts?: { ownerUserId?: string },
): Promise<DocumentRulesLoadResult> {
  const tenantId = companyId;
  const database = getMongoDatabaseName();

  if (!isMongoNativeConfigured()) {
    logger.warn('Usando fallback mock de regras porque MongoDB não está configurado.', {
      companyId: tenantId,
      database,
      mockClassesCount: DOCUMENT_CLASS_RULES.length,
    } as Record<string, unknown>);

    return {
      rules: DOCUMENT_CLASS_RULES,
      source: 'mock',
      companyId: tenantId,
      database,
      activeClassesCount: DOCUMENT_CLASS_RULES.length,
      activeRulesCount: DOCUMENT_CLASS_RULES.length,
      usedMockFallback: true,
      mockFallbackReason: 'mongodb_not_configured',
    };
  }

  const { documentClasses, documentRules, storage } = await getTenantCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  if (!documentClasses || !documentRules) {
    throw new DocumentRulesNotSeededError(
      'Regras documentais não disponíveis para este tipo de cliente.',
    );
  }

  const scope = buildClassRuleOwnershipFilter(storage);
  const classes = await documentClasses
    .find({ ...scope, active: true })
    .toArray();

  const rules = await documentRules
    .find({ ...scope, active: true })
    .sort({ classId: 1, version: -1 })
    .toArray();

  const activeClassesCount = classes.length;
  const activeRulesCount = rules.length;
  const mapped = mapMongoRules(classes, rules);

  if (!activeClassesCount || !mapped.length) {
    logger.error('Classes/regras ativas ausentes no MongoDB.', {
      companyId: tenantId,
      database,
      activeClassesCount,
      activeRulesCount,
      mappedRulesCount: mapped.length,
    } as Record<string, unknown>);

    throw new DocumentRulesNotSeededError(
      'Classes e regras ativas não encontradas no MongoDB. Execute npm run db:setup para popular o banco.',
    );
  }

  return {
    rules: mapped,
    source: 'mongodb',
    companyId: tenantId,
    database,
    activeClassesCount,
    activeRulesCount,
    usedMockFallback: false,
  };
}

export async function getActiveDocumentClassRules(
  companyId: string = DEV_TENANT_ID,
  opts?: { ownerUserId?: string },
): Promise<DocumentClassRule[]> {
  const loaded = await loadActiveDocumentClassRules(companyId, opts);
  return loaded.rules;
}

export async function getActiveRulesPayload(
  companyId: string = DEV_TENANT_ID,
  opts?: { ownerUserId?: string },
) {
  const tenantId = companyId;
  if (!isMongoNativeConfigured()) {
    return {
      companyId: tenantId,
      database: getMongoDatabaseName(),
      source: 'mock' as const,
      activeClassesCount: DOCUMENT_CLASS_RULES.length,
      activeRulesCount: DOCUMENT_CLASS_RULES.length,
      classes: DOCUMENT_CLASS_RULES,
    };
  }

  const { documentClasses, documentRules, storage } = await getTenantCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  if (!documentClasses || !documentRules) {
    return {
      companyId: tenantId,
      database: getMongoDatabaseName(),
      source: 'empty' as const,
      activeClassesCount: 0,
      activeRulesCount: 0,
      setupHint: 'Regras documentais indisponíveis para este tipo de cliente.',
      classes: [],
    };
  }

  const scope = buildClassRuleOwnershipFilter(storage);
  const database = getMongoDatabaseName();
  const classes = await documentClasses
    .find({ ...scope, active: true })
    .project({ _id: 1, name: 1, description: 1, keywords: 1, negativeKeywords: 1, permissions: 1 })
    .toArray();

  const rules = await documentRules
    .find({ ...scope, active: true })
    .sort({ classId: 1, version: -1 })
    .toArray();

  const latestRules = new Map<string, MongoDocumentRule>();
  for (const rule of rules) {
    if (!latestRules.has(rule.classId)) {
      latestRules.set(rule.classId, rule);
    }
  }

  if (!classes.length) {
    return {
      companyId: tenantId,
      database,
      source: 'empty' as const,
      activeClassesCount: 0,
      activeRulesCount: rules.length,
      setupHint: 'Execute npm run db:setup para popular classes e regras.',
      classes: [],
    };
  }

  return {
    companyId: tenantId,
    database,
    source: 'mongodb' as const,
    activeClassesCount: classes.length,
    activeRulesCount: rules.length,
    classes: classes.map((docClass) => ({
      ...docClass,
      rule: latestRules.get(docClass._id) ?? null,
    })),
  };
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

  const { documentClasses, documentRules, storage } = await getTenantCollections(tenantId, {
    userId: input.ownerUserId,
  });
  if (!documentClasses || !documentRules) {
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

  const scope = buildClassRuleOwnershipFilter(storage);
  const activeClassesCount = await documentClasses.countDocuments({ ...scope, active: true });
  const activeRulesCount = await documentRules.countDocuments({ ...scope, active: true });

  const docClass = await documentClasses.findOne({
    ...scope,
    _id: input.classId,
    active: true,
  } as Record<string, unknown>);

  const rule = docClass
    ? await documentRules.findOne(
        {
          ...scope,
          classId: input.classId,
          active: true,
        },
        { sort: { version: -1 } },
      )
    : null;

  return {
    companyId: tenantId,
    classId: input.classId,
    className: input.className ?? null,
    database,
    documentClassFound: Boolean(docClass),
    documentRuleFound: Boolean(rule),
    activeClassesCount,
    activeRulesCount,
  };
}

export async function getMongoClassAndRule(input: {
  companyId: string;
  classId: string;
  ownerUserId?: string;
}): Promise<{ docClass: MongoDocumentClass; rule: MongoDocumentRule } | null> {
  const tenantId = input.companyId;
  const { documentClasses, documentRules, storage } = await getTenantCollections(tenantId, {
    userId: input.ownerUserId,
  });
  if (!documentClasses || !documentRules) return null;

  const scope = buildClassRuleOwnershipFilter(storage);
  const docClass = await documentClasses.findOne({
    ...scope,
    _id: input.classId,
    active: true,
  } as Record<string, unknown>);

  if (!docClass) return null;

  const rule = await documentRules.findOne(
    {
      ...scope,
      classId: input.classId,
      active: true,
    },
    { sort: { version: -1 } },
  );

  if (!rule) return null;

  return { docClass: docClass as MongoDocumentClass, rule: rule as MongoDocumentRule };
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
