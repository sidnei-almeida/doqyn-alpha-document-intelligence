import type { MongoDocumentExtractionRule, MongoRuleField } from '../db/types.js';
import { normalizeExpiryAlertConfig } from './expiry/documentExpiryAlertService.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import { withClassRuleFieldsFromContext } from '../tenancy/tenantQuery.js';

/**
 * Regra de extração mínima para uma categoria recém-criada.
 *
 * Categoria sem regra ativa era uma armadilha silenciosa: aparecia no seletor da revisão, mas a
 * confirmação exige classe **e** regra ativa (`getMongoClassAndRule`) e devolvia 404
 * `CLASS_OR_RULE_NOT_FOUND` — "Classe ou regra ativa não encontrada no sistema". Pior: o
 * classificador só recebe as classes que têm regra, então a IA também nunca conseguia classificar
 * ali. Quem criava uma categoria pela interface ganhava uma pasta que não aceitava documento.
 *
 * Os campos aqui existem em qualquer documento, de propósito: a regra padrão não tenta adivinhar o
 * que a categoria significa, só garante que ela seja utilizável desde o primeiro segundo. Quem
 * quiser campos próprios edita a regra depois.
 */
export const DEFAULT_EXTRACTION_RULE_FIELDS: MongoRuleField[] = [
  {
    key: 'data_referencia',
    label: 'Data de referência',
    type: 'date',
    required: false,
    description: 'Data que identifica o documento: emissão, assinatura, validade ou revisão.',
    aliases: ['data', 'data de emissão', 'data de assinatura', 'emitido em'],
  },
  {
    key: 'partes_envolvidas',
    label: 'Partes envolvidas',
    type: 'string',
    required: false,
    description: 'Pessoas ou empresas que o documento identifica.',
    aliases: ['partes', 'emissor', 'destinatário', 'fornecedor', 'cliente'],
  },
];

/** Regra ativa precisa de ao menos um campo, então o padrão nunca pode ficar vazio. */
export const DEFAULT_EXTRACTION_RULE_NAMING_TEMPLATE = '{data_referencia}';

/**
 * Cria a regra padrão de uma categoria.
 *
 * Mora em módulo próprio porque `documentExtractionRulesService` já importa
 * `documentCategoriesService` (para `assertDocumentCategoryExists`), e chamar o caminho normal de
 * criação de regra a partir da criação de categoria fecharia um ciclo entre os dois.
 *
 * Idempotente: se a categoria já tiver qualquer regra, não faz nada e devolve `null`. Isso permite
 * chamar em backfill sem duplicar regra de quem já está configurado.
 */
export async function ensureDefaultExtractionRule(
  tenantId: string,
  categoryId: string,
  userId: string,
): Promise<MongoDocumentExtractionRule | null> {
  const collections = await requireTenantGovernanceCollections(tenantId, { userId });

  const existing = await collections.documentExtractionRules.findOne({
    categoryId,
  } as Record<string, unknown>);
  if (existing) return null;

  const now = new Date();
  const rule = withClassRuleFieldsFromContext(
    collections.storage,
    {
      _id: `ext_${categoryId}_v1`,
      categoryId,
      classId: categoryId,
      version: 1,
      active: true,
      fields: DEFAULT_EXTRACTION_RULE_FIELDS,
      namingTemplate: DEFAULT_EXTRACTION_RULE_NAMING_TEMPLATE,
      minimumConfidence: 0.7,
      onLowConfidence: 'requires_review' as const,
      expiryAlerts: normalizeExpiryAlertConfig(undefined),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    userId,
  ) as MongoDocumentExtractionRule;

  // `_id` é global na coleção compartilhada dos tenants PF: duas pessoas com uma categoria de mesmo
  // nome chegariam ao mesmo `ext_cat_pessoal_v1` e a segunda quebraria no insert.
  const idTaken = await collections.documentExtractionRules.findOne({
    _id: rule._id,
  } as Record<string, unknown>);
  if (idTaken) {
    rule._id = `ext_${categoryId}_v1_${Date.now().toString(36)}`;
  }

  await collections.documentExtractionRules.insertOne(rule as Record<string, unknown>);
  return rule;
}
