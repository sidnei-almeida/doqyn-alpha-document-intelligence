import { randomUUID } from 'node:crypto';
import type { MongoDocumentRule, MongoRuleField } from '../db/types.js';
import { assertDocumentClassExists } from './documentClassesService.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { requireBusinessAdminCollections } from '../tenancy/requireBusinessCollections.js';
import { tenantScopeFilter, withTenantFields } from '../tenancy/tenantQuery.js';

const ALLOWED_FIELD_TYPES = new Set(['string', 'date', 'number', 'currency', 'boolean']);

function serializeDocumentRule(rule: MongoDocumentRule) {
  return {
    id: rule._id,
    tenantId: rule.tenantId ?? rule.companyId,
    companyId: rule.companyId,
    classId: rule.classId,
    version: rule.version,
    active: rule.active,
    fields: rule.fields,
    namingTemplate: rule.namingTemplate,
    minimumConfidence: rule.minimumConfidence,
    onLowConfidence: rule.onLowConfidence,
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

export async function listDocumentRules(tenantId: string) {
  const { documentRules: collection } = await requireBusinessAdminCollections(tenantId);
  const rules = await collection
    .find(tenantScopeFilter(tenantId))
    .sort({ classId: 1, version: -1 })
    .toArray();

  return (rules as MongoDocumentRule[]).map(serializeDocumentRule);
}

export async function createDocumentRule(
  tenantId: string,
  userId: string,
  input: {
    classId: string;
    version?: number;
    active?: boolean;
    fields: MongoRuleField[];
    namingTemplate: string;
    minimumConfidence?: number;
    onLowConfidence?: 'requires_review';
  },
) {
  await assertDocumentClassExists(tenantId, input.classId);

  const namingTemplate = input.namingTemplate?.trim();
  if (!namingTemplate) {
    throw new ServiceError('namingTemplate é obrigatório.', 'VALIDATION_ERROR', 400);
  }

  const version = input.version ?? 1;
  const active = input.active ?? true;
  validateFields(input.fields, active);

  const minimumConfidence = input.minimumConfidence ?? 0.7;
  if (minimumConfidence < 0 || minimumConfidence > 1) {
    throw new ServiceError('minimumConfidence deve estar entre 0 e 1.', 'VALIDATION_ERROR', 400);
  }

  const { documentRules: collection } = await requireBusinessAdminCollections(tenantId);
  const scope = tenantScopeFilter(tenantId);

  let id = `rule_${input.classId.replace(/^class_/, '')}_v${version}`;
  const existingId = await collection.findOne({
    ...scope,
    _id: id,
  } as Record<string, unknown>);

  if (existingId) {
    id = `rule_${randomUUID().slice(0, 8)}_v${version}`;
  }

  const now = new Date();
  const rule = withTenantFields(tenantId, {
    _id: id,
    classId: input.classId,
    version,
    active,
    fields: input.fields,
    namingTemplate,
    minimumConfidence,
    onLowConfidence: 'requires_review',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  }) as MongoDocumentRule;

  await collection.insertOne(rule as Record<string, unknown>);

  return serializeDocumentRule(rule);
}

export async function updateDocumentRule(
  tenantId: string,
  ruleId: string,
  input: {
    fields?: MongoRuleField[];
    namingTemplate?: string;
    minimumConfidence?: number;
    active?: boolean;
    onLowConfidence?: 'requires_review';
  },
) {
  const { documentRules: collection } = await requireBusinessAdminCollections(tenantId);
  const scope = tenantScopeFilter(tenantId);
  const existing = await collection.findOne({
    ...scope,
    _id: ruleId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Regra não encontrada.', 'NOT_FOUND', 404);
  }

  const existingRule = existing as MongoDocumentRule;
  const patch: Partial<MongoDocumentRule> = { updatedAt: new Date() };
  const nextActive = input.active ?? existingRule.active;

  if (input.fields !== undefined) {
    validateFields(input.fields, nextActive);
    patch.fields = input.fields;
  }

  if (input.namingTemplate !== undefined) {
    const namingTemplate = input.namingTemplate.trim();
    if (!namingTemplate) {
      throw new ServiceError('namingTemplate não pode ser vazio.', 'VALIDATION_ERROR', 400);
    }
    patch.namingTemplate = namingTemplate;
  }

  if (input.minimumConfidence !== undefined) {
    if (input.minimumConfidence < 0 || input.minimumConfidence > 1) {
      throw new ServiceError('minimumConfidence deve estar entre 0 e 1.', 'VALIDATION_ERROR', 400);
    }
    patch.minimumConfidence = input.minimumConfidence;
  }

  if (input.active !== undefined) patch.active = input.active;
  if (input.onLowConfidence !== undefined) patch.onLowConfidence = input.onLowConfidence;

  if (nextActive && (patch.fields ?? existingRule.fields).length === 0) {
    throw new ServiceError('Regra ativa precisa de ao menos um campo.', 'VALIDATION_ERROR', 400);
  }

  await collection.updateOne({ ...scope, _id: ruleId } as Record<string, unknown>, {
    $set: patch,
  });

  const updated = await collection.findOne({
    ...scope,
    _id: ruleId,
  } as Record<string, unknown>);

  return serializeDocumentRule(updated as MongoDocumentRule);
}

export async function toggleDocumentRuleActive(tenantId: string, ruleId: string) {
  const { documentRules: collection } = await requireBusinessAdminCollections(tenantId);
  const scope = tenantScopeFilter(tenantId);
  const existing = await collection.findOne({
    ...scope,
    _id: ruleId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Regra não encontrada.', 'NOT_FOUND', 404);
  }

  const existingRule = existing as MongoDocumentRule;
  const active = !existingRule.active;
  if (active && existingRule.fields.length === 0) {
    throw new ServiceError('Regra ativa precisa de ao menos um campo.', 'VALIDATION_ERROR', 400);
  }

  await collection.updateOne({ ...scope, _id: ruleId } as Record<string, unknown>, {
    $set: { active, updatedAt: new Date() },
  });

  return { id: ruleId, active };
}
