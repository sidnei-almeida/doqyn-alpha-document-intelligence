#!/usr/bin/env node
/**
 * Smoke test manual contra Cloudflare R2 real.
 * Valida TenantStorageScope: business (per_tenant) e individual (shared + basePrefix).
 * Não roda em npm test — apenas via npm run r2:smoke.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import {
  HeadObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import { resolveTenantStorageScope } from '../server/tenancy/resolveTenantStorageScope.js';
import { createR2AdminClient, createR2RuntimeClient } from '../server/storage/r2/r2Clients.js';
import {
  ensureBucketForStorageScope,
  headTenantBucket,
} from '../server/storage/r2/r2BucketProvisioner.js';
import { getTenantBucketName } from '../server/storage/r2/r2BucketNaming.js';
import { createR2StorageProvider } from '../server/storage/r2/r2StorageProvider.js';
import {
  buildAnalysisStagingKey,
  buildDocumentPreviewObjectKey,
  buildDocumentVersionObjectKey,
} from '../server/storage/storageKeys.js';
import {
  getR2ConfigFromEnv,
  getStorageConfig,
  validateR2Endpoint,
} from '../server/storage/storageConfig.js';
import type { TenantStorageScope } from '../server/tenancy/resolveTenantStorageScope.js';

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

function info(message: string): void {
  console.log(`INFO: ${message}`);
}

function smokeId(prefix: string): string {
  const suffix = createHash('sha256').update(randomBytes(8)).digest('hex').slice(0, 8);
  return `${prefix}_${suffix}`;
}

async function assertObjectAbsent(
  runtimeClient: ReturnType<typeof createR2RuntimeClient>,
  bucket: string,
  key: string,
): Promise<void> {
  try {
    await runtimeClient.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    fail(`objeto ainda presente após cleanup: ${key}`);
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status === 404 || name === 'NotFound' || error instanceof NotFound) {
      return;
    }
    throw error;
  }
}

async function runStagingLifecycle(input: {
  label: string;
  scope: TenantStorageScope;
  provider: ReturnType<typeof createR2StorageProvider>;
  runtimeClient: ReturnType<typeof createR2RuntimeClient>;
  jobId: string;
}): Promise<string> {
  const { label, scope, provider, runtimeClient, jobId } = input;
  const payload = Buffer.from(`doqyn-r2-smoke-staging-${label}-${Date.now()}`);
  const expectedKey = buildAnalysisStagingKey({
    jobId,
    extension: 'pdf',
    basePrefix: scope.basePrefix || undefined,
  });

  info(`[${label}] staging key esperada: ${expectedKey}`);

  const stagingKey = await provider.storeStagingFile({
    tenantId: scope.tenantId,
    jobId,
    buffer: payload,
    mimeType: 'application/pdf',
    originalFileName: 'smoke-original.pdf',
    ownerUserId: scope.ownerUserId,
    storageScope: scope,
  });

  if (stagingKey !== expectedKey) {
    fail(`[${label}] staging key divergente: ${stagingKey}`);
  }

  await runtimeClient.send(
    new HeadObjectCommand({ Bucket: scope.bucketName, Key: stagingKey }),
  );
  ok(`[${label}] staging PutObject + HeadObject`);

  const loaded = await provider.loadStagingFile({
    tenantId: scope.tenantId,
    jobId,
    mimeType: 'application/pdf',
    originalFileName: 'smoke-original.pdf',
    ownerUserId: scope.ownerUserId,
    storageScope: scope,
  });

  if (!loaded.equals(payload)) {
    fail(`[${label}] staging GetObject conteúdo divergente`);
  }
  ok(`[${label}] staging GetObject`);

  await provider.deleteStagingFile({
    tenantId: scope.tenantId,
    jobId,
    mimeType: 'application/pdf',
    originalFileName: 'smoke-original.pdf',
    ownerUserId: scope.ownerUserId,
    storageScope: scope,
  });

  await assertObjectAbsent(runtimeClient, scope.bucketName, stagingKey);
  ok(`[${label}] staging DeleteObject + cleanup`);

  return expectedKey;
}

async function runDocumentVersionLifecycle(input: {
  label: string;
  scope: TenantStorageScope;
  provider: ReturnType<typeof createR2StorageProvider>;
  runtimeClient: ReturnType<typeof createR2RuntimeClient>;
  documentId: string;
  versionId: string;
}): Promise<{ bucket: string; objectKey: string }> {
  const { label, scope, provider, runtimeClient, documentId, versionId } = input;
  const payload = Buffer.from(`%PDF-1.4 doqyn-r2-smoke-doc-${label}-${Date.now()}`);
  const storageFileName = 'smoke_document.pdf';
  const previewStorageFileName = 'smoke_document_preview.pdf';
  const expectedKey = buildDocumentVersionObjectKey({
    documentId,
    versionId,
    storageFileName,
    keyPrefix: scope.keyPrefix,
    basePrefix: scope.basePrefix || undefined,
  });

  info(`[${label}] document objectKey esperada: ${expectedKey}`);

  const expectedPreviewKey = buildDocumentPreviewObjectKey({
    documentId,
    versionId,
    previewStorageFileName,
    keyPrefix: scope.keyPrefix,
    basePrefix: scope.basePrefix || undefined,
  });
  info(`[${label}] preview objectKey esperada (validação de path, sem upload): ${expectedPreviewKey}`);

  const stored = await provider.storeDocumentVersion({
    tenantId: scope.tenantId,
    documentId,
    versionId,
    buffer: payload,
    mimeType: 'application/pdf',
    extension: 'pdf',
    storageFileName,
    storageScope: scope,
  });

  if (stored.storageKey !== expectedKey) {
    fail(`[${label}] objectKey divergente: ${stored.storageKey}`);
  }

  if (stored.bucket !== scope.bucketName) {
    fail(`[${label}] bucket divergente: esperado ${scope.bucketName}, obtido ${stored.bucket}`);
  }

  await runtimeClient.send(
    new HeadObjectCommand({ Bucket: stored.bucket!, Key: stored.storageKey }),
  );
  ok(`[${label}] document PutObject + HeadObject (bucket=${stored.bucket})`);

  const read = await provider.readDocumentVersion(
    stored.storageKey,
    scope.tenantId,
    stored.bucket,
  );

  if (!read.buffer.equals(payload)) {
    fail(`[${label}] document GetObject conteúdo divergente`);
  }
  ok(`[${label}] document GetObject`);

  await provider.deleteDocumentVersion(
    stored.storageKey,
    scope.tenantId,
    stored.bucket,
    scope,
  );

  await assertObjectAbsent(runtimeClient, stored.bucket!, stored.storageKey);
  ok(`[${label}] document DeleteObject + cleanup`);

  return { bucket: stored.bucket!, objectKey: stored.storageKey };
}

async function runBusinessScenario(input: {
  r2: NonNullable<ReturnType<typeof getR2ConfigFromEnv>>;
  adminClient: ReturnType<typeof createR2AdminClient>;
  runtimeClient: ReturnType<typeof createR2RuntimeClient>;
  provider: ReturnType<typeof createR2StorageProvider>;
}): Promise<{ bucket: string; objectKey: string }> {
  const ts = Date.now();
  const tenantId = `smoke_business_${ts}`.slice(0, 48);
  const scope = resolveTenantStorageScope({
    tenantId,
    tenantType: 'business',
    ownerUserId: '11111111-1111-4111-8111-111111110001',
  });

  if (scope.bucketMode !== 'per_tenant') {
    fail('business: bucketMode deve ser per_tenant');
  }
  if (scope.basePrefix !== '') {
    fail('business: basePrefix deve ser vazio');
  }
  if (!/^doqyn-t-[a-f0-9]{12}$/.test(scope.bucketName)) {
    fail(`business: bucketName inválido: ${scope.bucketName}`);
  }

  const { bucket } = await ensureBucketForStorageScope({
    bucketMode: scope.bucketMode,
    bucketName: scope.bucketName,
    tenantId: scope.tenantId,
    config: input.r2,
    adminClient: input.adminClient,
  });

  if (bucket !== scope.bucketName) {
    fail('business: bucket provisionado diverge do scope');
  }
  ok(`business bucket provisionado: ${bucket}`);

  const jobId = smokeId('smoke_job');
  const documentId = smokeId('smoke_doc');
  const versionId = smokeId('smoke_ver');

  await runStagingLifecycle({
    label: 'business',
    scope,
    provider: input.provider,
    runtimeClient: input.runtimeClient,
    jobId,
  });

  const doc = await runDocumentVersionLifecycle({
    label: 'business',
    scope,
    provider: input.provider,
    runtimeClient: input.runtimeClient,
    documentId,
    versionId,
  });

  return doc;
}

async function runIndividualScenario(input: {
  r2: NonNullable<ReturnType<typeof getR2ConfigFromEnv>>;
  adminClient: ReturnType<typeof createR2AdminClient>;
  runtimeClient: ReturnType<typeof createR2RuntimeClient>;
  provider: ReturnType<typeof createR2StorageProvider>;
}): Promise<{ bucket: string; objectKey: string; perTenantBucketAbsent: boolean }> {
  const ts = Date.now();
  const tenantId = `smoke_individual_${ts}`.slice(0, 48);
  const ownerUserId = '22222222-2222-4222-8222-222222220002';

  const wouldBePerTenantBucket = getTenantBucketName(tenantId, {
    bucketPrefix: input.r2.bucketPrefix,
    bucketMode: 'per_tenant',
    defaultBucket: input.r2.defaultBucket,
  });

  const perTenantBefore = await headTenantBucket(input.adminClient, wouldBePerTenantBucket);
  if (perTenantBefore) {
    info(
      `individual: bucket per_tenant legado já existia (${wouldBePerTenantBucket}) — não será usado`,
    );
  } else {
    ok(`individual: bucket per_tenant (${wouldBePerTenantBucket}) ausente antes do teste`);
  }

  const scope = resolveTenantStorageScope({
    tenantId,
    tenantType: 'individual',
    ownerUserId,
  });

  if (scope.bucketMode !== 'shared') {
    fail('individual: bucketMode deve ser shared');
  }
  if (scope.bucketName !== input.r2.defaultBucket) {
    fail(`individual: bucketName deve ser ${input.r2.defaultBucket}`);
  }
  if (!scope.basePrefix.startsWith('individuals/')) {
    fail(`individual: basePrefix inválido: ${scope.basePrefix}`);
  }
  if (scope.bucketName === wouldBePerTenantBucket) {
    fail('individual: bucket compartilhado não deve coincidir com bucket per_tenant');
  }

  const { bucket } = await ensureBucketForStorageScope({
    bucketMode: scope.bucketMode,
    bucketName: scope.bucketName,
    tenantId: scope.tenantId,
    config: input.r2,
    adminClient: input.adminClient,
  });

  if (bucket !== input.r2.defaultBucket) {
    fail('individual: deve usar bucket compartilhado R2_DEFAULT_BUCKET');
  }
  ok(`individual bucket compartilhado garantido: ${bucket}`);

  const perTenantAfter = await headTenantBucket(input.adminClient, wouldBePerTenantBucket);
  if (perTenantAfter && !perTenantBefore) {
    fail(`individual: bucket per_tenant foi criado indevidamente (${wouldBePerTenantBucket})`);
  }
  if (!perTenantAfter) {
    ok(`individual: bucket per_tenant (${wouldBePerTenantBucket}) não foi criado`);
  }

  const jobId = smokeId('smoke_job');
  const documentId = smokeId('smoke_doc');
  const versionId = smokeId('smoke_ver');

  await runStagingLifecycle({
    label: 'individual',
    scope,
    provider: input.provider,
    runtimeClient: input.runtimeClient,
    jobId,
  });

  const doc = await runDocumentVersionLifecycle({
    label: 'individual',
    scope,
    provider: input.provider,
    runtimeClient: input.runtimeClient,
    documentId,
    versionId,
  });

  if (!doc.objectKey.startsWith(`${scope.basePrefix}/documents/`)) {
    fail(`individual: objectKey deve começar com ${scope.basePrefix}/documents/`);
  }

  return {
    bucket: doc.bucket,
    objectKey: doc.objectKey,
    perTenantBucketAbsent: !perTenantAfter,
  };
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

  const adminClient = createR2AdminClient(r2);
  const runtimeClient = createR2RuntimeClient(r2);
  const storageConfig = getStorageConfig();
  if (!storageConfig.r2) {
    fail('storage config R2 ausente');
  }

  const provider = createR2StorageProvider(storageConfig);
  await provider.ensureReady();
  ok('provider R2 pronto (runtime para objetos, admin para buckets)');

  console.log('\n--- Cenário A: business / CNPJ (per_tenant) ---');
  const business = await runBusinessScenario({
    r2,
    adminClient,
    runtimeClient,
    provider,
  });

  console.log('\n--- Cenário B: individual / CPF (shared + basePrefix) ---');
  const individual = await runIndividualScenario({
    r2,
    adminClient,
    runtimeClient,
    provider,
  });

  console.log('\nRESULTADO: OK — smoke test R2 TenantStorageScope concluído');
  info(`business bucket: ${business.bucket}`);
  info(`business objectKey: ${business.objectKey}`);
  info(`individual bucket: ${individual.bucket}`);
  info(`individual objectKey: ${individual.objectKey}`);
  info(
    individual.perTenantBucketAbsent
      ? 'individual não criou bucket per_tenant dedicado'
      : 'individual usou bucket compartilhado; bucket per_tenant legado pré-existente não foi usado',
  );
  info('buckets reais não foram removidos; apenas objetos smoke_* foram deletados');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.log(`FAIL: ${message}`);
  process.exit(1);
});
