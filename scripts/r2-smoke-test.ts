#!/usr/bin/env node
/**
 * Smoke test manual contra Cloudflare R2 real.
 * Não roda em npm test — apenas via npm run r2:smoke.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createR2AdminClient, createR2RuntimeClient } from '../server/storage/r2/r2Clients.js';
import { ensureTenantBucket } from '../server/storage/r2/r2BucketProvisioner.js';
import { getR2ConfigFromEnv, validateR2Endpoint } from '../server/storage/storageConfig.js';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function loadEnv(): void {
  const filePath = process.env.ENV_FILE?.trim() || '.env';
  const fromFile = parseEnvFile(filePath);
  for (const [key, value] of Object.entries(fromFile)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function fail(message: string): never {
  console.log(`FAIL: ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

async function main(): Promise<void> {
  loadEnv();

  if (process.env.STORAGE_PROVIDER !== 'r2') {
    fail('STORAGE_PROVIDER deve ser r2');
  }

  const r2 = getR2ConfigFromEnv();
  if (!r2) {
    fail('config R2 incompleta');
  }

  if (!validateR2Endpoint(r2.endpoint, r2.accountId)) {
    fail('R2_ENDPOINT inválido');
  }

  if (!r2.runtimeAccessKeyId || !r2.runtimeSecretAccessKey) {
    fail('credenciais runtime ausentes');
  }

  if (!r2.adminAccessKeyId || !r2.adminSecretAccessKey) {
    fail('credenciais admin ausentes');
  }

  ok('variáveis de ambiente validadas (sem expor segredos)');

  const tenantId = process.env.R2_SMOKE_TENANT_ID?.trim() || 'smoke_test_tenant';
  const adminClient = createR2AdminClient(r2);
  const runtimeClient = createR2RuntimeClient(r2);

  const { bucket } = await ensureTenantBucket({ tenantId, config: r2, adminClient });
  ok(`bucket tenant provisionado: ${bucket}`);

  const objectKey = `tmp/smoke-${createHash('sha256').update(randomBytes(8)).digest('hex').slice(0, 12)}/original.txt`;
  const payload = Buffer.from(`doqyn-r2-smoke-${Date.now()}`);

  await runtimeClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: payload,
      ContentType: 'text/plain',
    }),
  );
  ok('PutObject concluído');

  await runtimeClient.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  ok('HeadObject concluído');

  const getResult = await runtimeClient.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of getResult.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  const downloaded = Buffer.concat(chunks);
  if (!downloaded.equals(payload)) {
    fail('conteúdo baixado não confere');
  }
  ok('GetObject concluído');

  await runtimeClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  ok('DeleteObject concluído');

  console.log('\nRESULTADO: OK — smoke test R2 concluído com sucesso');
  console.log('INFO: bucket não foi removido automaticamente');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.log(`FAIL: ${message}`);
  process.exit(1);
});
