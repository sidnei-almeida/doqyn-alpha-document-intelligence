/**
 * Cria e inspeciona o índice vetorial de `document_chunks` no Atlas.
 *
 * A definição vive em `server/db/vectorIndexes.ts`, versionada junto do resto do schema —
 * criar pelo console funciona, mas ninguém depois consegue dizer com que filtros o índice
 * ficou, e campo de filtro não se acrescenta sem recriar.
 *
 *   npx tsx scripts/atlas-vector-index.ts status
 *   npx tsx scripts/atlas-vector-index.ts create
 *   npx tsx scripts/atlas-vector-index.ts drop --confirm-drop-vector-index
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import {
  buildDocumentChunksVectorIndex,
  getVectorIndexCollectionName,
} from '../server/db/vectorIndexes.js';
import { VECTOR_INDEX_NAME } from '../server/ai/embeddings/embeddingConfig.js';

dotenv.config();

type SearchIndexRow = {
  name?: string;
  type?: string;
  status?: string;
  queryable?: boolean;
  latestDefinition?: unknown;
};

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'status';
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE;

  if (!uri || !dbName) {
    console.error('MONGODB_URI e MONGODB_DATABASE são obrigatórios.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const collectionName = getVectorIndexCollectionName();
    const collection = client.db(dbName).collection(collectionName);
    const existing = (await collection.listSearchIndexes().toArray()) as SearchIndexRow[];
    const current = existing.find((row) => row.name === VECTOR_INDEX_NAME);

    if (command === 'status') {
      console.log(`banco: ${dbName} · coleção: ${collectionName}`);
      if (!current) {
        console.log(`índice ${VECTOR_INDEX_NAME}: ausente`);
      } else {
        console.log(
          `índice ${VECTOR_INDEX_NAME}: ${current.status} · consultável: ${current.queryable}`,
        );
        console.log(JSON.stringify(current.latestDefinition, null, 2));
      }
      const total = await collection.estimatedDocumentCount();
      const embedded = await collection.countDocuments({ embedding: { $type: 'array' } });
      console.log(`chunks: ${total} · com embedding: ${embedded}`);
      return;
    }

    if (command === 'create') {
      if (current) {
        console.log(`índice ${VECTOR_INDEX_NAME} já existe (${current.status}); nada a fazer.`);
        console.log('Para mudar campos de filtro ou dimensão é preciso dropar e recriar.');
        return;
      }

      const spec = buildDocumentChunksVectorIndex();
      await collection.createSearchIndex(spec);
      console.log(`índice ${VECTOR_INDEX_NAME} solicitado em ${collectionName}.`);
      console.log('A construção é assíncrona — rode `status` até ficar READY e queryable.');
      return;
    }

    if (command === 'drop') {
      // Dropar apaga o índice inteiro e a busca semântica para de responder até a
      // reconstrução terminar. Exige intenção explícita.
      if (!process.argv.includes('--confirm-drop-vector-index')) {
        console.error('Recusado: passe --confirm-drop-vector-index para confirmar.');
        process.exit(1);
      }
      if (!current) {
        console.log(`índice ${VECTOR_INDEX_NAME} não existe; nada a fazer.`);
        return;
      }
      await collection.dropSearchIndex(VECTOR_INDEX_NAME);
      console.log(`índice ${VECTOR_INDEX_NAME} removido.`);
      return;
    }

    console.error(`Comando desconhecido: ${command}. Use status | create | drop.`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
