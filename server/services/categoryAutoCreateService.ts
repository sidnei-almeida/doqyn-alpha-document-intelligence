/**
 * Cria a pasta que a IA propôs, na confirmação.
 *
 * Mora aqui e não na análise por decisão de 21/09/2026: análise abandonada, reenviada ou barrada
 * na revisão não pode deixar pasta órfã no tenant, e a escrita de governança fica no caminho que
 * já resolve tenant, dono e permissão. A análise só propõe; quem materializa é a confirmação.
 *
 * Entra antes do `ensureUncategorizedCategory`: "Sem categoria" continua sendo o destino de quem
 * não tem proposta, de quem estourou o teto, e de quem desligou a sugestão.
 */
import type { SuggestedCategory } from '../ai/types/documentAi.types.js';
import type { MongoDocumentCategory } from '../db/types.js';
import { createDocumentCategory } from './documentCategoriesService.js';
import { getTenantUploadPolicy } from './settings/uploadPolicySettings.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { slugifyName } from '../utils/slugify.js';
import { logger } from '../utils/logger.js';

/**
 * Quantas pastas a IA pode criar sozinha num tenant.
 *
 * Existe porque `auto_create` é a configuração que ninguém revisa: sem teto, um lote de cem
 * documentos heterogêneos cria cem pastas, e a empresa perde a taxonomia em uma tarde. Estourado
 * o teto, o documento cai em "Sem categoria" — que é o comportamento de antes, não uma falha.
 */
export const AI_CATEGORY_AUTO_CREATE_LIMIT = 30;

export type AutoCreatedCategory = {
  categoryId: string;
  /** `created` = nasceu agora; `reused` = a pasta proposta já existia e foi reaproveitada. */
  outcome: 'created' | 'reused';
};

/**
 * As três operações que tocam o banco, injetáveis.
 *
 * Existe para o teste provar dedupe, teto e corrida sem subir Mongo — o mesmo recurso que
 * `refineExtraction` usa com `deps`. Em produção ninguém passa nada e vale a implementação real.
 */
export type CategoryAutoCreateDeps = {
  findBySlug: (tenantId: string, userId: string, slug: string) => Promise<string | null>;
  countCreatedByAi: (tenantId: string, userId: string) => Promise<number>;
  create: (input: {
    tenantId: string;
    userId: string;
    suggestion: SuggestedCategory;
    slug: string;
  }) => Promise<{ id: string; name: string }>;
};

/**
 * Cria (ou reaproveita) a categoria proposta.
 *
 * Devolve `null` quando não há o que criar — sem proposta, teto estourado, ou falha na escrita.
 * Nenhum desses casos pode derrubar a confirmação: o documento tem destino de reserva.
 */
export async function createCategoryFromSuggestion(input: {
  tenantId: string;
  userId: string;
  suggestion: SuggestedCategory;
  requestId?: string;
  deps?: Partial<CategoryAutoCreateDeps>;
}): Promise<AutoCreatedCategory | null> {
  const slug = slugifyName(input.suggestion.name);
  if (!slug) return null;

  const findBySlug = input.deps?.findBySlug ?? findCategoryBySlug;
  const countCreatedByAi = input.deps?.countCreatedByAi ?? countAiCreatedCategories;
  const create = input.deps?.create ?? createCategoryRecord;

  try {
    // Dedupe antes do teto: reaproveitar pasta existente não consome cota nenhuma, e o modelo
    // propõe a mesma pasta para o segundo boleto que ele propôs para o primeiro.
    const existing = await findBySlug(input.tenantId, input.userId, slug);
    if (existing) {
      return { categoryId: existing, outcome: 'reused' };
    }

    const createdByAi = await countCreatedByAi(input.tenantId, input.userId);

    if (createdByAi >= AI_CATEGORY_AUTO_CREATE_LIMIT) {
      logger.warn('teto de categorias criadas pela IA atingido', {
        requestId: input.requestId,
        tenantId: input.tenantId,
        limit: AI_CATEGORY_AUTO_CREATE_LIMIT,
        suggestedName: input.suggestion.name,
      });
      return null;
    }

    const category = await create({
      tenantId: input.tenantId,
      userId: input.userId,
      suggestion: input.suggestion,
      slug,
    });

    logger.info('categoria criada automaticamente a partir da sugestão da IA', {
      requestId: input.requestId,
      tenantId: input.tenantId,
      categoryId: category.id,
      name: category.name,
      createdByAiCount: createdByAi + 1,
    });

    return { categoryId: category.id, outcome: 'created' };
  } catch (error) {
    /**
     * Dois envios simultâneos propõem a mesma pasta: ambos leem "não existe" e ambos tentam criar.
     * Perder a corrida não é erro — a pasta que o outro criou serve, e é a mesma pasta.
     */
    const isDuplicate =
      error instanceof ServiceError
        ? error.code === 'DUPLICATE_SLUG'
        : /E11000|duplicate key/i.test(error instanceof Error ? error.message : '');

    if (isDuplicate) {
      const raced = await findBySlug(input.tenantId, input.userId, slug);
      if (raced) return { categoryId: raced, outcome: 'reused' };
    }

    logger.warn('categoria sugerida não pôde ser criada', {
      requestId: input.requestId,
      tenantId: input.tenantId,
      suggestedName: input.suggestion.name,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

async function findCategoryBySlug(
  tenantId: string,
  userId: string,
  slug: string,
): Promise<string | null> {
  const collections = await requireTenantGovernanceCollections(tenantId, { userId });
  const scope = buildClassRuleOwnershipFilter(collections.storage);

  const found = (await collections.documentCategories.findOne({
    ...scope,
    slug,
  } as Record<string, unknown>)) as MongoDocumentCategory | null;

  return found?._id ?? null;
}

/**
 * Conta com escopo de tenant, sempre.
 *
 * Na coleção compartilhada dos tenants PF, contar só por `createdByAi` somaria as pastas do
 * vizinho e o teto de um cortaria o outro.
 */
async function countAiCreatedCategories(tenantId: string, userId: string): Promise<number> {
  const collections = await requireTenantGovernanceCollections(tenantId, { userId });
  const scope = buildClassRuleOwnershipFilter(collections.storage);

  return collections.documentCategories.countDocuments({
    ...scope,
    createdByAi: true,
  } as Record<string, unknown>);
}

async function createCategoryRecord(input: {
  tenantId: string;
  userId: string;
  suggestion: SuggestedCategory;
  slug: string;
}): Promise<{ id: string; name: string }> {
  const category = await createDocumentCategory(input.tenantId, input.userId, {
    name: input.suggestion.name,
    description: input.suggestion.description,
    keywords: input.suggestion.keywords,
    slug: input.slug,
    createdByAi: true,
  });

  return { id: category.id, name: category.name };
}

/**
 * Materializa a pasta proposta pela IA, se — e só se — o tenant pediu isso.
 *
 * A política é lida aqui, no servidor, e não no cliente, porque é ela que autoriza a escrita: um
 * payload forjado com `suggestedCategory` não pode criar pasta num tenant que escolheu `off` ou
 * `suggest`. Falha de leitura da política significa não criar nada — na dúvida "Sem categoria",
 * que é reversível, em vez de uma pasta que ninguém pediu.
 *
 * Os dois caminhos de confirmação chamam esta função: o direto (`confirmAnalysisPersistence`) e o
 * do envio que passa por aprovação. Separá-los faria o envio aprovado cair em categoria diferente
 * da que a revisão mostrou.
 */
export async function resolveAutoCreatedCategoryId(input: {
  tenantId: string;
  userId: string;
  suggestion?: {
    name: string;
    description: string;
    keywords?: string[];
    reason?: string;
  } | null;
  requestId?: string;
  deps?: Partial<CategoryAutoCreateDeps> & { readPolicy?: typeof getTenantUploadPolicy };
}): Promise<string | undefined> {
  if (!input.suggestion?.name?.trim()) return undefined;

  const readPolicy = input.deps?.readPolicy ?? getTenantUploadPolicy;

  let mode;
  try {
    mode = (await readPolicy(input.tenantId)).categorySuggestionMode;
  } catch {
    return undefined;
  }

  if (mode !== 'auto_create') return undefined;

  const created = await createCategoryFromSuggestion({
    tenantId: input.tenantId,
    userId: input.userId,
    suggestion: {
      name: input.suggestion.name,
      description: input.suggestion.description,
      keywords: input.suggestion.keywords ?? [],
      reason: input.suggestion.reason ?? '',
    },
    requestId: input.requestId,
    deps: input.deps,
  });

  return created?.categoryId;
}
