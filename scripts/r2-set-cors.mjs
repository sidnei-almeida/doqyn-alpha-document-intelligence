#!/usr/bin/env node
/**
 * Aplica a política de CORS dos buckets R2.
 *
 * O upload com URL pré-assinada é feito pelo navegador direto contra o R2, então sem essa
 * política todo PUT volta 403 sem cabeçalho `Access-Control-Allow-Origin` e o arquivo nunca
 * sai da máquina do usuário. Nada disso aparece no log do servidor — a requisição sequer
 * chega nele.
 *
 * Uso (dentro do container da API, que já tem o SDK e as credenciais no ambiente):
 *   node r2-set-cors.mjs                 # aplica
 *   node r2-set-cors.mjs --dry-run       # só mostra o que faria
 */
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';

const dryRun = process.argv.includes('--dry-run');

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ADMIN_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.R2_ADMIN_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error('Faltam R2_ENDPOINT e credenciais no ambiente.');
  process.exit(1);
}

const origins = (process.env.ALLOWED_ORIGINS || process.env.DOQYN_PUBLIC_APP_URL || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (origins.length === 0) {
  console.error('Nenhuma origem: defina ALLOWED_ORIGINS ou DOQYN_PUBLIC_APP_URL.');
  process.exit(1);
}

const client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

/**
 * `ETag` precisa ser exposto: é o que o cliente usa para confirmar que o objeto gravado é o
 * que ele enviou. Sem `expose`, o navegador esconde o cabeçalho mesmo com o PUT bem-sucedido.
 */
const corsRules = [
  {
    AllowedOrigins: origins,
    AllowedMethods: ['PUT', 'GET', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  },
];

const buckets = [];
const explicit = process.env.R2_DEFAULT_BUCKET;
if (explicit) buckets.push(explicit);

try {
  const listed = await client.send(new ListBucketsCommand({}));
  for (const bucket of listed.Buckets ?? []) {
    if (bucket.Name && !buckets.includes(bucket.Name)) buckets.push(bucket.Name);
  }
} catch (error) {
  console.warn(`Não foi possível listar buckets (${error.name}); seguindo só com o default.`);
}

console.log(`Origens permitidas: ${origins.join(', ')}`);
console.log(`Buckets alvo: ${buckets.join(', ')}`);

for (const bucket of buckets) {
  if (dryRun) {
    console.log(`[dry-run] aplicaria CORS em ${bucket}`);
    continue;
  }

  try {
    await client.send(
      new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: corsRules } }),
    );
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    const applied = current.CORSRules?.[0];
    console.log(
      `OK ${bucket}: origens=${applied?.AllowedOrigins?.join(',')} métodos=${applied?.AllowedMethods?.join(',')}`,
    );
  } catch (error) {
    console.error(`FALHA ${bucket}: ${error.name} — ${error.message}`);
  }
}
