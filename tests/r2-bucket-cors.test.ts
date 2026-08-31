import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  bucketCorsSatisfies,
  corsPolicyHash,
  ensureBucketCors,
  resetBucketCorsCache,
  resolveCorsOrigins,
} from '../server/storage/r2/bucketCors.ts';
import { ensureBucketForStorageScope } from '../server/storage/r2/r2BucketProvisioner.ts';
import { isServiceError } from '../server/utils/serviceErrors.ts';
import type { R2Config } from '../server/storage/storageConfig.ts';

const ORIGINAL_ENV = { ...process.env };

const R2_CONFIG: R2Config = {
  accountId: 'abc123',
  endpoint: 'https://abc123.r2.cloudflarestorage.com',
  region: 'auto',
  bucketMode: 'per_tenant',
  defaultBucket: 'doqyn-alpha',
  bucketPrefix: 'doqyn',
  keyPrefix: 'documents',
  runtimeAccessKeyId: 'runtime-key',
  runtimeSecretAccessKey: 'runtime-secret',
  adminAccessKeyId: 'admin-key',
  adminSecretAccessKey: 'admin-secret',
  adminApiToken: '',
};

type SentCommand = { name: string; input: Record<string, unknown> };

type FakeClientOptions = {
  /** Buckets que já existem — `HeadBucket` responde 200 para eles. */
  existingBuckets?: string[];
  /** Política já presente no bucket, devolvida por `GetBucketCors`. */
  existingCors?: Record<string, unknown[] | undefined>;
  /** Faz `PutBucketCors` falhar, simulando token admin sem permissão. */
  failPutCors?: boolean;
  /** `PutBucketCors` responde OK mas não grava nada — o bucket segue mudo. */
  putCorsIsNoop?: boolean;
};

function createFakeClient(options: FakeClientOptions = {}) {
  const sent: SentCommand[] = [];
  const existing = new Set(options.existingBuckets ?? []);
  const cors: Record<string, unknown[] | undefined> = { ...(options.existingCors ?? {}) };

  const client = {
    sent,
    cors,
    async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
      const name = command.constructor.name;
      const bucket = String(command.input.Bucket ?? '');
      sent.push({ name, input: command.input });

      if (name === 'HeadBucketCommand') {
        if (existing.has(bucket)) return {};
        const error = new Error('not found') as Error & { name: string };
        error.name = 'NotFound';
        throw error;
      }

      if (name === 'CreateBucketCommand') {
        existing.add(bucket);
        return {};
      }

      if (name === 'GetBucketCorsCommand') {
        const rules = cors[bucket];
        if (!rules) {
          const error = new Error('no cors') as Error & { name: string };
          error.name = 'NoSuchCORSConfiguration';
          throw error;
        }
        return { CORSRules: rules };
      }

      if (name === 'PutBucketCorsCommand') {
        if (options.failPutCors) {
          const error = new Error('access denied') as Error & { name: string };
          error.name = 'AccessDenied';
          throw error;
        }
        if (!options.putCorsIsNoop) {
          const config = command.input.CORSConfiguration as { CORSRules: unknown[] };
          cors[bucket] = config.CORSRules;
        }
        return {};
      }

      throw new Error(`comando não esperado: ${name}`);
    },
  };

  return client;
}

function countCommands(client: { sent: SentCommand[] }, name: string): number {
  return client.sent.filter((command) => command.name === name).length;
}

function goodRule(origins: string[]) {
  return {
    AllowedOrigins: origins,
    AllowedMethods: ['GET', 'PUT', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  };
}

describe('cors do bucket R2', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.DOQYN_PUBLIC_APP_URL;
    delete process.env.PUBLIC_APP_URL;
    resetBucketCorsCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetBucketCorsCache();
  });

  describe('origens', () => {
    it('une ALLOWED_ORIGINS e DOQYN_PUBLIC_APP_URL sem duplicar', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.doqyn.com, https://www.doqyn.com/';
      process.env.DOQYN_PUBLIC_APP_URL = 'https://app.doqyn.com/';

      assert.deepEqual(resolveCorsOrigins(), ['https://app.doqyn.com', 'https://www.doqyn.com']);
    });

    it('não libera localhost em produção', () => {
      process.env.NODE_ENV = 'production';
      process.env.DOQYN_PUBLIC_APP_URL = 'https://app.doqyn.com';

      assert.deepEqual(resolveCorsOrigins(), ['https://app.doqyn.com']);
    });

    it('libera localhost fora de produção', () => {
      process.env.NODE_ENV = 'development';
      process.env.DOQYN_PUBLIC_APP_URL = 'http://localhost:5173';

      assert.deepEqual(resolveCorsOrigins(), ['http://localhost:5173']);
    });

    it('sem origem nenhuma, ensureBucketCors falha em vez de aplicar política vazia', async () => {
      process.env.NODE_ENV = 'production';
      const client = createFakeClient();

      await assert.rejects(
        () => ensureBucketCors(client as never, 'doqyn-alpha'),
        (error: unknown) => isServiceError(error) && error.code === 'R2_CORS_ORIGINS_MISSING',
      );
    });
  });

  describe('bucketCorsSatisfies', () => {
    it('aceita política mais ampla que a exigida', () => {
      const rules = [goodRule(['*'])];
      assert.equal(bucketCorsSatisfies(rules, ['https://app.doqyn.com']), true);
    });

    it('recusa política sem PUT', () => {
      const rules = [{ ...goodRule(['https://app.doqyn.com']), AllowedMethods: ['GET', 'HEAD'] }];
      assert.equal(bucketCorsSatisfies(rules, ['https://app.doqyn.com']), false);
    });

    it('recusa política sem ETag exposto', () => {
      const rules = [{ ...goodRule(['https://app.doqyn.com']), ExposeHeaders: [] }];
      assert.equal(bucketCorsSatisfies(rules, ['https://app.doqyn.com']), false);
    });

    it('recusa quando falta uma das origens', () => {
      const rules = [goodRule(['https://app.doqyn.com'])];
      assert.equal(
        bucketCorsSatisfies(rules, ['https://app.doqyn.com', 'https://www.doqyn.com']),
        false,
      );
    });

    it('recusa bucket sem política nenhuma', () => {
      assert.equal(bucketCorsSatisfies(undefined, ['https://app.doqyn.com']), false);
    });
  });

  describe('ensureBucketCors', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.DOQYN_PUBLIC_APP_URL = 'https://app.doqyn.com';
    });

    it('aplica quando o bucket não tem política', async () => {
      const client = createFakeClient();

      const result = await ensureBucketCors(client as never, 'doqyn-alpha');

      assert.equal(result.applied, true);
      assert.equal(countCommands(client, 'PutBucketCorsCommand'), 1);
      assert.equal(bucketCorsSatisfies(client.cors['doqyn-alpha'], ['https://app.doqyn.com']), true);
    });

    it('não reescreve política que já satisfaz (token sem PutBucketCors segue funcionando)', async () => {
      const client = createFakeClient({
        existingCors: { 'doqyn-alpha': [goodRule(['https://app.doqyn.com'])] },
        failPutCors: true,
      });

      const result = await ensureBucketCors(client as never, 'doqyn-alpha');

      assert.equal(result.applied, false);
      assert.equal(countCommands(client, 'PutBucketCorsCommand'), 0);
    });

    it('falha quando PutBucketCors é recusado e a política não basta', async () => {
      const client = createFakeClient({ failPutCors: true });

      await assert.rejects(
        () => ensureBucketCors(client as never, 'doqyn-alpha'),
        (error: unknown) => isServiceError(error) && error.code === 'R2_CORS_NOT_CONFIGURED',
      );
    });

    it('falha quando a política não confere depois de aplicada', async () => {
      const client = createFakeClient({ putCorsIsNoop: true });

      await assert.rejects(
        () => ensureBucketCors(client as never, 'doqyn-alpha'),
        (error: unknown) => isServiceError(error) && error.code === 'R2_CORS_NOT_CONFIGURED',
      );
    });

    it('cache evita segunda ida à rede, e force ignora o cache', async () => {
      const client = createFakeClient();

      await ensureBucketCors(client as never, 'doqyn-alpha');
      const afterFirst = client.sent.length;

      await ensureBucketCors(client as never, 'doqyn-alpha');
      assert.equal(client.sent.length, afterFirst, 'segunda chamada não deve ir à rede');

      await ensureBucketCors(client as never, 'doqyn-alpha', { force: true });
      assert.ok(client.sent.length > afterFirst, 'force deve ignorar o cache');
    });

    it('mudança de origem invalida o cache e reaplica', async () => {
      const client = createFakeClient();
      await ensureBucketCors(client as never, 'doqyn-alpha');
      const applied = countCommands(client, 'PutBucketCorsCommand');

      process.env.ALLOWED_ORIGINS = 'https://app.doqyn.com,https://www.doqyn.com';
      const result = await ensureBucketCors(client as never, 'doqyn-alpha');

      assert.equal(result.applied, true);
      assert.equal(countCommands(client, 'PutBucketCorsCommand'), applied + 1);
      assert.equal(
        bucketCorsSatisfies(client.cors['doqyn-alpha'], [
          'https://app.doqyn.com',
          'https://www.doqyn.com',
        ]),
        true,
      );
    });

    it('hash muda com as origens', () => {
      assert.notEqual(
        corsPolicyHash(['https://app.doqyn.com']),
        corsPolicyHash(['https://app.doqyn.com', 'https://www.doqyn.com']),
      );
      assert.equal(
        corsPolicyHash(['https://a.com', 'https://b.com']),
        corsPolicyHash(['https://b.com', 'https://a.com']),
      );
    });
  });

  describe('ensureBucketForStorageScope', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.DOQYN_PUBLIC_APP_URL = 'https://app.doqyn.com';
    });

    it('PJ: bucket novo nasce com CORS', async () => {
      const client = createFakeClient();

      const result = await ensureBucketForStorageScope({
        bucketMode: 'per_tenant',
        bucketName: 'doqyn-acme-a1b2c3',
        tenantId: 'tenant-acme',
        config: R2_CONFIG,
        adminClient: client as never,
      });

      assert.equal(result.created, true);
      assert.equal(countCommands(client, 'CreateBucketCommand'), 1);
      assert.equal(
        bucketCorsSatisfies(client.cors['doqyn-acme-a1b2c3'], ['https://app.doqyn.com']),
        true,
      );
    });

    /**
     * A regressão principal: antes a política vivia dentro de `createTenantBucket`, então bucket
     * que já existia — criado à mão, ou criado antes de uma troca de domínio — nunca a recebia.
     */
    it('PJ: bucket que já existe sem CORS recebe a política', async () => {
      const client = createFakeClient({ existingBuckets: ['doqyn-acme-a1b2c3'] });

      const result = await ensureBucketForStorageScope({
        bucketMode: 'per_tenant',
        bucketName: 'doqyn-acme-a1b2c3',
        tenantId: 'tenant-acme',
        config: R2_CONFIG,
        adminClient: client as never,
      });

      assert.equal(result.created, false);
      assert.equal(countCommands(client, 'CreateBucketCommand'), 0);
      assert.equal(countCommands(client, 'PutBucketCorsCommand'), 1);
      assert.equal(
        bucketCorsSatisfies(client.cors['doqyn-acme-a1b2c3'], ['https://app.doqyn.com']),
        true,
      );
    });

    it('PF: bucket compartilhado que já existe é reconciliado', async () => {
      const client = createFakeClient({ existingBuckets: ['doqyn-alpha'] });

      const result = await ensureBucketForStorageScope({
        bucketMode: 'shared',
        bucketName: 'doqyn-alpha',
        tenantId: 'tenant-pf',
        config: R2_CONFIG,
        adminClient: client as never,
      });

      assert.equal(result.created, false);
      assert.equal(bucketCorsSatisfies(client.cors['doqyn-alpha'], ['https://app.doqyn.com']), true);
      assert.equal(result.corsPolicyHash, corsPolicyHash(['https://app.doqyn.com']));
    });

    it('bucket não passa por pronto quando o CORS não pôde ser aplicado', async () => {
      const client = createFakeClient({ failPutCors: true });

      await assert.rejects(
        () =>
          ensureBucketForStorageScope({
            bucketMode: 'per_tenant',
            bucketName: 'doqyn-acme-a1b2c3',
            tenantId: 'tenant-acme',
            config: R2_CONFIG,
            adminClient: client as never,
          }),
        (error: unknown) => isServiceError(error) && error.code === 'R2_CORS_NOT_CONFIGURED',
      );
    });
  });
});
