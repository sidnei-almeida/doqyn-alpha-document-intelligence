/**
 * Vetoriza chunks já persistidos em `document_chunks`.
 *
 * Existe para o corpo que foi gravado antes do embedding existir — todo chunk anterior tem
 * `embedding: null` e é invisível para `$vectorSearch`, mesmo com o índice READY.
 *
 * Roda sobre a base inteira de propósito: é operação de infraestrutura, não caminho de
 * produto. O recorte por tenant continua valendo na leitura, que é onde importa — o índice
 * declara `tenantId` como campo de filtro.
 *
 *   npx tsx scripts/rag-embed-backfill.ts --dry-run
 *   npx tsx scripts/rag-embed-backfill.ts
 *   npx tsx scripts/rag-embed-backfill.ts --tenant tenant_123 --limit 500
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { embedChunksMatching } from '../server/services/documentChunkEmbeddingService.js';
import { getVectorIndexCollectionName } from '../server/db/vectorIndexes.js';
import { getEmbeddingBatchSize, getEmbeddingModel } from '../server/ai/embeddings/embeddingConfig.js';
import type { MongoDocumentChunk } from '../server/db/types.js';

dotenv.config();

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE;

  if (!uri || !dbName) {
    console.error('MONGODB_URI e MONGODB_DATABASE são obrigatórios.');
    process.exit(1);
  }

  const tenantId = readFlag('tenant');
  const documentId = readFlag('document');
  const limitRaw = readFlag('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const dryRun = process.argv.includes('--dry-run');

  if (limitRaw && (!Number.isFinite(limit) || (limit as number) <= 0)) {
    console.error(`--limit inválido: ${limitRaw}`);
    process.exit(1);
  }

  const filter: Record<string, unknown> = {};
  if (tenantId) filter.tenantId = tenantId;
  if (documentId) filter.documentId = documentId;

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const collectionName = getVectorIndexCollectionName();
    const collection = client.db(dbName).collection<MongoDocumentChunk>(collectionName);

    const pending = await collection.countDocuments({ ...filter, embedding: null });
    const total = await collection.countDocuments(filter);

    console.log(`banco: ${dbName} · coleção: ${collectionName}`);
    console.log(`escopo: ${JSON.stringify(filter)}`);
    console.log(`chunks no escopo: ${total} · pendentes de vetor: ${pending}`);

    if (dryRun) {
      console.log('--dry-run: nada foi gravado.');
      return;
    }

    if (pending === 0) {
      console.log('Nada a vetorizar.');
      return;
    }

    console.log(
      `modelo: ${getEmbeddingModel()} · lote: ${getEmbeddingBatchSize()} — a primeira carga ` +
        'demora se o ONNX ainda não estiver em cache.',
    );

    const result = await embedChunksMatching(collection, filter, { limit });

    console.log(
      `vetorizados: ${result.embedded}/${result.scanned} em ${result.batches} lotes · ` +
        `${result.durationMs}ms (${(result.durationMs / Math.max(result.embedded, 1)).toFixed(0)}ms por chunk)`,
    );

    const stillPending = await collection.countDocuments({ ...filter, embedding: null });
    console.log(`pendentes restantes: ${stillPending}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
