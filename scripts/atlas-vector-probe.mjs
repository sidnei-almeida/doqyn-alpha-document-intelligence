// Sonda somente-leitura: descobre se o cluster Atlas aceita Vector Search e o que
// já existe de índice de busca em document_chunks. Não cria nem altera nada.
//
// Uso: node scripts/atlas-vector-probe.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(REPO, '.env') });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE;
if (!uri || !dbName) {
  console.error('MONGODB_URI ou MONGODB_DATABASE ausente no .env');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

// Host sem credencial — só para confirmar contra qual cluster estamos falando.
const hello = await db.admin().command({ hello: 1 });
console.log('banco:', dbName);
console.log('topologia:', hello.msg ?? hello.setName ?? 'desconhecida');
console.log('host:', String(hello.me ?? '').replace(/:\d+$/, ''));

const chunkCount = await db.collection('document_chunks').estimatedDocumentCount();
const withEmbedding = await db
  .collection('document_chunks')
  .countDocuments({ embedding: { $type: 'array' } });
console.log(`document_chunks: ${chunkCount} documentos, ${withEmbedding} com embedding`);

try {
  const indexes = await db.collection('document_chunks').listSearchIndexes().toArray();
  console.log('Vector/Search Search SUPORTADO neste cluster.');
  console.log(
    indexes.length
      ? `indices de busca existentes: ${JSON.stringify(indexes.map((i) => ({ name: i.name, type: i.type, status: i.status })))}`
      : 'indices de busca existentes: nenhum',
  );
} catch (error) {
  console.log('listSearchIndexes falhou — provavelmente sem suporte neste tier.');
  console.log('erro:', String(error?.codeName ?? error?.message ?? error).slice(0, 200));
}

await client.close();
