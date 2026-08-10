import { randomUUID } from 'node:crypto';
import type {
  MongoDocumentExpiryAlertConfig,
  MongoDocumentExtractionRule,
  MongoRuleField,
} from '../db/types.js';
import { assertDocumentCategoryExists } from './documentCategoriesService.js';
import { normalizeExpiryAlertConfig } from './expiry/documentExpiryAlertService.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import { withClassRuleFieldsFromContext } from '../tenancy/tenantQuery.js';

const ALLOWED_FIELD_TYPES = new Set(['string', 'date', 'number', 'currency', 'boolean']);

type ServiceOpts = { ownerUserId?: string };

async function resolveContext(tenantId: string, opts?: ServiceOpts) {
  const collections = await requireTenantGovernanceCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  const scope = buildClassRuleOwnershipFilter(collections.storage);
  return { collections, scope, storage: collections.storage };
}

function serializeExtractionRule(rule: MongoDocumentExtractionRule) {
  return {
    id: rule._id,
    tenantId: rule.tenantId ?? rule.companyId,
    companyId: rule.companyId,
    categoryId: rule.categoryId,
    classId: rule.categoryId,
    version: rule.version,
    active: rule.active,
    fields: rule.fields,
    namingTemplate: rule.namingTemplate,
    minimumConfidence: rule.minimumConfidence,
    onLowConfidence: rule.onLowConfidence,
    expiryAlerts: normalizeExpiryAlertConfig(rule.expiryAlerts),
    createdBy: rule.createdBy,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

function validateFields(fields: MongoRuleField[], active: boolean) {
  if (!Array.isArray(fields)) {
    throw new ServiceError('fields deve ser um array.', 'VALIDATION_ERROR', 400);
  }

  if (active && fields.length === 0) {
    throw new ServiceError('Regra ativa precisa de ao menos um campo.', 'VALIDATION_ERROR', 400);
  }

  for (const field of fields) {
    if (!field.key?.trim() || !field.label?.trim()) {
      throw new ServiceError('Cada campo precisa de key e label.', 'VALIDATION_ERROR', 400);
    }
    if (!ALLOWED_FIELD_TYPES.has(field.type)) {
      throw new ServiceError(`Tipo de campo inválido: ${field.type}`, 'VALIDATION_ERROR', 400);
    }
    if (typeof field.required !== 'boolean') {
      throw new ServiceError('required deve ser boolean em cada campo.', 'VALIDATION_ERROR', 400);
    }
  }
}

export async function listDocumentExtractionRules(tenantId: string, opts?: ServiceOpts) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const rules = await collections.documentExtractionRules
    .find(scope)
    .sort({ categoryId: 1, version: -1 })
    .toArray();

  return (rules as MongoDocumentExtractionRule[]).map(serializeExtractionRule);
}

export async function createDocumentExtractionRule(
  tenantId: string,
  userId: string,
  input: {
    categoryId: string;
    version?: number;
    active?: boolean;
    fields: MongoRuleField[];
    namingTemplate: string;
    minimumConfidence?: number;
    expiryAlerts?: Partial<MongoDocumentExpiryAlertConfig>;
  },
) {
  await assertDocumentCategoryExists(tenantId, input.categoryId, { ownerUserId: userId });

  const active = input.active ?? true;
  validateFields(input.fields, active);

  const { collections, scope, storage } = await resolveContext(tenantId, { ownerUserId: userId });
  const now = new Date();
  const version = input.version ?? 1;

  const rule = withClassRuleFieldsFromContext(
    storage,
    {
      _id: `ext_${input.categoryId}_v${version}`,
      categoryId: input.categoryId,
      classId: input.categoryId,
      version,
      active,
      fields: input.fields,
      namingTemplate: input.namingTemplate.trim(),
      minimumConfidence: input.minimumConfidence ?? 0.7,
      onLowConfidence: 'requires_review' as const,
      expiryAlerts: normalizeExpiryAlertConfig(input.expiryAlerts),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    userId,
  ) as MongoDocumentExtractionRule;

  const existing = await collections.documentExtractionRules.findOne({
    ...scope,
    _id: rule._id,
  } as Record<string, unknown>);

  if (existing) {
    rule._id = `ext_${randomUUID().slice(0, 12)}`;
  }

  await collections.documentExtractionRules.insertOne(rule as Record<string, unknown>);
  return serializeExtractionRule(rule);
}

export async function updateDocumentExtractionRule(
  tenantId: string,
  ruleId: string,
  input: {
    fields?: MongoRuleField[];
    namingTemplate?: string;
    minimumConfidence?: number;
    active?: boolean;
    expiryAlerts?: Partial<MongoDocumentExpiryAlertConfig>;
  },
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const existing = await collections.documentExtractionRules.findOne({
    ...scope,
    _id: ruleId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Regra de extração não encontrada.', 'NOT_FOUND', 404);
  }

  const current = existing as MongoDocumentExtractionRule;
  const active = input.active ?? current.active;
  const fields = input.fields ?? current.fields;
  validateFields(fields, active);

  const patch: Partial<MongoDocumentExtractionRule> = {
    updatedAt: new Date(),
    fields,
    active,
  };

  if (input.namingTemplate !== undefined) patch.namingTemplate = input.namingTemplate.trim();
  if (input.minimumConfidence !== undefined) patch.minimumConfidence = input.minimumConfidence;
  if (input.expiryAlerts !== undefined) {
    // Normaliza aqui, e não no handler, para que qualquer caminho de escrita — API, seed ou
    // script — grave a mesma forma: marcos deduplicados, ordenados e dentro do limite.
    patch.expiryAlerts = normalizeExpiryAlertConfig(input.expiryAlerts);
  }

  await collections.documentExtractionRules.updateOne(
    { ...scope, _id: ruleId } as Record<string, unknown>,
    { $set: patch },
  );

  const updated = await collections.documentExtractionRules.findOne({
    ...scope,
    _id: ruleId,
  } as Record<string, unknown>);

  return serializeExtractionRule(updated as MongoDocumentExtractionRule);
}

/**
 * Cria regra de extração mínima v1 para uma categoria recém-criada no tenant atual.
 * Escopo: somente o tenantId informado — não cria em outros tenants nem catálogo global.
 * Não roda no provisionamento de empresa nova; só ao criar categoria via API/UI.
 *
 * TODO: Futuro — regras de extração devem ser configuradas explicitamente por classe
 * documental do tenant. A regra default criada junto da categoria é apenas um rascunho
 * inicial do tenant, não catálogo global.
 */
export async function createDefaultExtractionRuleForCategory(
  tenantId: string,
  userId: string,
  categoryId: string,
  slug: string,
) {
  void slug;
  return createDocumentExtractionRule(tenantId, userId, {
    categoryId,
    version: 1,
    active: true,
    fields: [
      {
        key: 'referencia',
        label: 'Referência / parte principal',
        type: 'string',
        required: false,
        aliases: ['referência', 'referencia', 'parte', 'empresa', 'fornecedor', 'cliente'],
      },
      {
        key: 'titulo',
        label: 'Título',
        type: 'string',
        required: false,
        aliases: ['título', 'titulo', 'assunto'],
      },
      {
        key: 'data_assinatura',
        label: 'Data de referência',
        type: 'date',
        required: false,
        aliases: ['data de assinatura', 'data', 'emitido em'],
      },
    ],
    namingTemplate: '{referencia}_{titulo}_{data_assinatura}_v{version}',
    minimumConfidence: 0.7,
  });
}
