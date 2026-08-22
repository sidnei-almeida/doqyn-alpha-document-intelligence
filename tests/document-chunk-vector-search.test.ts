import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVectorSearchFilter,
  buildVectorSearchPipeline,
  buildVectorSearchPostFilter,
} from '../server/services/documentChunkVectorSearch.js';
import { getVectorIndexFilterPaths } from '../server/db/vectorIndexes.js';
import { VECTOR_INDEX_NAME } from '../server/ai/embeddings/embeddingConfig.js';
import type { TenantStorageContext } from '../server/tenancy/tenantStorage.js';

const businessStorage = {
  tenantId: 'tenant_a',
  tenantType: 'business',
  storageMode: 'shared_collections',
  collectionPrefix: 'company_a',
  collections: {},
} as unknown as TenantStorageContext;

const individualStorage = {
  tenantId: 'tenant_pf',
  tenantType: 'individual',
  storageMode: 'shared_individual_collection',
  collectionPrefix: 'individual',
  userId: 'user_1',
  collections: {},
} as unknown as TenantStorageContext;

/** Caminha o filtro (aninhado em `$and`) e devolve os campos usados. */
function filterPaths(filter: Record<string, unknown>): string[] {
  const clauses = Array.isArray(filter.$and)
    ? (filter.$and as Record<string, unknown>[])
    : [filter];
  return clauses.flatMap((clause) => Object.keys(clause));
}

describe('buildVectorSearchFilter', () => {
  it('sempre recorta por tenant — sem isso o vizinho mais próximo pode ser de outro cliente', () => {
    const filter = buildVectorSearchFilter(businessStorage);
    assert.ok(filterPaths(filter).includes('tenantId'));
    assert.deepEqual(
      (filter.$and as Record<string, unknown>[])[0],
      { tenantId: { $eq: 'tenant_a' } },
    );
  });

  it('acrescenta ownerUserId no tenant PF', () => {
    const paths = filterPaths(buildVectorSearchFilter(individualStorage));
    assert.ok(paths.includes('tenantId'));
    assert.ok(paths.includes('ownerUserId'));
  });

  it('recusa tenant PF sem usuário em vez de buscar na coleção compartilhada inteira', () => {
    const semUsuario = { ...individualStorage, userId: undefined } as TenantStorageContext;
    assert.throws(() => buildVectorSearchFilter(semUsuario), /OWNER_USER_REQUIRED|ownerUserId/);
  });

  it('recusa contexto sem tenantId', () => {
    const semTenant = { ...businessStorage, tenantId: '' } as TenantStorageContext;
    assert.throws(() => buildVectorSearchFilter(semTenant), /tenantId/);
  });

  it('busca só a versão vigente por padrão, e aceita histórico quando pedido', () => {
    assert.ok(filterPaths(buildVectorSearchFilter(businessStorage)).includes('isCurrentVersion'));
    assert.ok(
      !filterPaths(buildVectorSearchFilter(businessStorage, { currentOnly: false })).includes(
        'isCurrentVersion',
      ),
    );
  });

  it('só usa campos declarados como filter no índice — os outros o Atlas rejeita', () => {
    const declared = new Set(getVectorIndexFilterPaths());
    const used = new Set([
      ...filterPaths(buildVectorSearchFilter(businessStorage, { documentId: 'doc_1' })),
      ...filterPaths(buildVectorSearchFilter(individualStorage, { documentId: 'doc_1' })),
    ]);

    for (const path of used) {
      assert.ok(declared.has(path), `campo "${path}" não é filter no índice ${VECTOR_INDEX_NAME}`);
    }
  });
});

describe('buildVectorSearchPostFilter', () => {
  it('reconfere com o filtro canônico de propriedade', () => {
    const filter = buildVectorSearchPostFilter(businessStorage, { documentId: 'doc_1' });
    assert.deepEqual(filter.$or, [{ tenantId: 'tenant_a' }, { companyId: 'tenant_a' }]);
    assert.equal(filter.documentId, 'doc_1');
    assert.equal(filter.isCurrentVersion, true);
  });

  it('aplica minScore quando informado', () => {
    assert.deepEqual(buildVectorSearchPostFilter(businessStorage, {}, 0.75).score, { $gte: 0.75 });
    assert.equal(buildVectorSearchPostFilter(businessStorage, {}).score, undefined);
  });
});

describe('buildVectorSearchPipeline', () => {
  const pipeline = buildVectorSearchPipeline({
    queryVector: [0.1, 0.2, 0.3],
    storage: businessStorage,
    tuning: { limit: 5 },
  });

  it('leva o recorte de tenant dentro do estágio de busca, não só depois dele', () => {
    const stage = pipeline[0].$vectorSearch;
    assert.equal(stage.index, VECTOR_INDEX_NAME);
    assert.equal(stage.path, 'embedding');
    assert.ok(filterPaths(stage.filter).includes('tenantId'));
  });

  it('examina mais candidatos do que devolve, senão o corte por filtro esvazia o topo', () => {
    const stage = pipeline[0].$vectorSearch;
    assert.equal(stage.limit, 5);
    assert.ok(stage.numCandidates > stage.limit);
  });

  it('expõe o score do Atlas e reconfere o escopo depois do ranking', () => {
    assert.deepEqual(pipeline[1].$set, { score: { $meta: 'vectorSearchScore' } });
    assert.ok(pipeline[2].$match.$or);
  });
});
