import type { MongoDocumentExtractionRule, MongoRuleField } from '../db/types.js';
import { CANONICAL_VALIDITY_KEY } from '../../shared/metadataKeyNormalize.js';
import { normalizeExpiryAlertConfig } from './expiry/documentExpiryAlertService.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
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
    /**
     * O campo que o alerta de vencimento lê.
     *
     * Ficou de fora até 07/09/2026, e o efeito era invisível: a tela do documento injeta uma linha
     * "Data de vencimento" mesmo quando a classe não declara campo de validade
     * (`DocumentExpiryEditor`, `VALIDITY_KEY`), então o campo aparecia como FALTANDO e ninguém via
     * que ele não existia na regra. A extração calculava a data a partir da âncora e do prazo e não
     * tinha onde escrevê-la — `deriveEndDates` só preenche campo declarado. Resultado: alerta que
     * nunca dispara, com a data à vista no papel.
     *
     * A chave é `data_validade` porque é a canônica do produto. Nasceu como `data_vencimento` e o
     * campo continuou aparecendo vazio na ficha: `canonicalizeMetadataKey`
     * (`shared/metadataKeyNormalize.ts`) renomeia `data_vencimento` para `data_validade` ao
     * confirmar a versão, então a linha da regra ficava eternamente sem dono enquanto o mesmo dado
     * aparecia logo abaixo, sob o nome canônico, como campo fora da regra.
     *
     * A regra geral: chave de campo da regra padrão tem que ser a que sobrevive à canonicalização.
     * `tests/default-extraction-rule-validity.test.ts` cobre isso — qualquer chave que o
     * normalizador renomearia quebra o teste antes de chegar ao banco de alguém.
     */
    key: CANONICAL_VALIDITY_KEY,
    label: 'Validade',
    type: 'date',
    required: false,
    description:
      'Data em que o documento perde validade (yyyy-mm-dd). Quase nunca está escrita: some a data ' +
      'âncora ao prazo que governa a validade deste documento. Sem âncora ou sem prazo, deixe null.',
    aliases: ['validade', 'vencimento', 'data de vencimento', 'vigência fim', 'vigencia fim', 'término', 'termino'],
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
  const scope = buildClassRuleOwnershipFilter(collections.storage);

  // Com escopo: na coleção compartilhada dos tenants PF, procurar só por `categoryId` enxergaria a
  // regra do vizinho e concluiria, errado, que este tenant já está configurado.
  const existing = await collections.documentExtractionRules.findOne({
    ...scope,
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

  try {
    await collections.documentExtractionRules.insertOne(rule as Record<string, unknown>);
  } catch (error) {
    // Duas criações concorrentes da mesma categoria: a checagem de `_id` acima passou nas duas antes
    // de qualquer insert acontecer. Perder a corrida não é erro — a regra do outro serve.
    if (/E11000|duplicate key/i.test(error instanceof Error ? error.message : '')) return null;
    throw error;
  }

  return rule;
}
