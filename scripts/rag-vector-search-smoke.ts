/**
 * Roda a busca vetorial real contra o Atlas, usando o mesmo pipeline do produto.
 *
 * O teste unitário prova a forma do pipeline; só o Atlas prova que o índice aceita esses campos
 * de filtro e que o recorte por tenant funciona lá dentro. Por isso a sonda termina consultando
 * com um tenant inexistente: se aquilo devolver trecho, o isolamento é ilusão.
 *
 *   npx tsx scripts/rag-vector-search-smoke.ts "qual o prazo de vigencia?"
 *   npx tsx scripts/rag-vector-search-smoke.ts "pergunta" --tenant tenant_123
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { embedQuery } from '../server/ai/embeddings/embeddingService.js';
import { buildVectorSearchPipeline } from '../server/services/documentChunkVectorSearch.js';
import { getVectorIndexCollectionName } from '../server/db/vectorIndexes.js';
import type { MongoDocumentChunk } from '../server/db/types.js';
import type { TenantStorageContext } from '../server/tenancy/tenantStorage.js';

dotenv.config();

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function storageFor(tenantId: string, ownerUserId?: string): TenantStorageContext {
  return {
    tenantId,
    tenantType: ownerUserId ? 'individual' : 'business',
    storageMode: ownerUserId ? 'shared_individual_collection' : 'shared_collections',
    collectionPrefix: '',
    userId: ownerUserId,
    collections: {},
  } as unknown as TenantStorageContext;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE;

  if (!uri || !dbName) {
    console.error('MONGODB_URI e MONGODB_DATABASE são obrigatórios.');
    process.exit(1);
  }

  const question = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
  if (!question) {
    console.error('Uso: npx tsx scripts/rag-vector-search-smoke.ts "pergunta" [--tenant id]');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const collection = client
      .db(dbName)
      .collection<MongoDocumentChunk>(getVectorIndexCollectionName());

    // Sem `--tenant`, usa o tenant de um chunk que já tem vetor — a sonda não deve exigir que
    // quem roda saiba de cor o id do tenant de desenvolvimento.
    let tenantId = readFlag('tenant');
    let ownerUserId = readFlag('owner');
    if (!tenantId) {
      const sample = await collection.findOne({ embedding: { $type: 'array' } });
      if (!sample) {
        console.error('Nenhum chunk vetorizado. Rode scripts/rag-embed-backfill.ts antes.');
        process.exit(1);
      }
      tenantId = sample.tenantId;
      ownerUserId = sample.tenantType === 'individual' ? sample.ownerUserId : undefined;
    }

    console.log(`banco: ${dbName} · tenant: ${tenantId}${ownerUserId ? ` · pf: ${ownerUserId}` : ''}`);
    console.log(`pergunta: ${JSON.stringify(question)}\n`);

    const queryVector = await embedQuery(question);
    const startedAt = Date.now();
    const hits = await collection
      .aggregate(
        buildVectorSearchPipeline({
          queryVector,
          storage: storageFor(tenantId, ownerUserId),
          tuning: { limit: 3 },
        }),
      )
      .toArray();
    console.log(`${hits.length} trechos em ${Date.now() - startedAt}ms\n`);

    for (const hit of hits) {
      console.log(`  [${Number(hit.score).toFixed(4)}] doc ${hit.documentId} · página ${hit.pageNumber ?? '?'} · chunk ${hit.chunkIndex}`);
      console.log(`  ${String(hit.text).replace(/\s+/g, ' ').slice(0, 200)}...\n`);
    }

    const intruso = await collection
      .aggregate(
        buildVectorSearchPipeline({
          queryVector,
          storage: storageFor('tenant_inexistente_smoke'),
          tuning: { limit: 3 },
        }),
      )
      .toArray();

    console.log(
      intruso.length === 0
        ? 'isolamento: tenant inexistente recebeu 0 trechos.'
        : `FALHA DE ISOLAMENTO: tenant inexistente recebeu ${intruso.length} trechos.`,
    );
    if (intruso.length > 0) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
