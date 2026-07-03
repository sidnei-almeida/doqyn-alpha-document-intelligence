import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  buildTenantBucketName,
  deriveTenantBucketSlug,
  deriveTenantShortHash,
  getTenantBucketName,
  isLegacyTenantBucketName,
  resolveR2AppEnv,
} from '../server/storage/r2/r2BucketNaming.js';

describe('buildTenantBucketName', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.APP_ENV = 'development';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('gera nomes estáveis com slug + hash', () => {
    const first = buildTenantBucketName({
      env: 'dev',
      tenantId: 'company_alpha_consultoria',
      tenantDisplayName: 'Alpha Consultoria Empresarial Ltda.',
      tenantSlug: 'alpha-consultoria',
    });
    const second = buildTenantBucketName({
      env: 'dev',
      tenantId: 'company_alpha_consultoria',
      tenantDisplayName: 'Alpha Consultoria Empresarial Ltda.',
      tenantSlug: 'alpha-consultoria',
    });

    assert.equal(first.bucketName, second.bucketName);
    assert.match(first.bucketName, /^doqyn-dev-t-alpha-consultoria-[a-f0-9]{12}$/);
    assert.equal(first.shortHash, deriveTenantShortHash('company_alpha_consultoria'));
  });

  it('não inclui CNPJ, CPF ou e-mail', () => {
    const result = buildTenantBucketName({
      env: 'dev',
      tenantId: 'company_nexserv',
      tenantDisplayName: 'NexServ Tecnologia e Serviços Ltda.',
      tenantSlug: 'nexserv-tecnologia',
    });

    assert.equal(result.bucketName.includes('cnpj'), false);
    assert.equal(result.bucketName.includes('@'), false);
    assert.equal(result.bucketName.includes('12345678901'), false);
    assert.match(result.bucketName, /^doqyn-dev-t-nexserv-tecnologia-[a-f0-9]{12}$/);
  });

  it('sanitiza acentos, underscore e espaços', () => {
    const slug = deriveTenantBucketSlug('Jurídico e Contratos', undefined, undefined);
    assert.equal(slug.includes('_'), false);
    assert.equal(slug.includes(' '), false);
    assert.match(slug, /^[a-z0-9-]+$/);

    const result = buildTenantBucketName({
      env: 'dev',
      tenantId: 'tenant_1',
      tenantDisplayName: 'Company Dev',
      tenantSlug: 'company_dev',
    });
    assert.match(result.bucketName, /^doqyn-dev-t-company-dev-[a-f0-9]{12}$/);
  });

  it('empresas com mesmo nome mas tenantId diferente geram buckets diferentes', () => {
    const a = buildTenantBucketName({
      env: 'dev',
      tenantId: 'company_a',
      tenantDisplayName: 'Alpha Consultoria',
      tenantSlug: 'alpha-consultoria',
    });
    const b = buildTenantBucketName({
      env: 'dev',
      tenantId: 'company_b',
      tenantDisplayName: 'Alpha Consultoria',
      tenantSlug: 'alpha-consultoria',
    });

    assert.notEqual(a.bucketName, b.bucketName);
    assert.notEqual(a.shortHash, b.shortHash);
  });

  it('fallback com slug mínimo do tenantId', () => {
    const result = buildTenantBucketName({
      env: 'dev',
      tenantId: 'tenant_x',
      tenantDisplayName: '!!!',
      tenantSlug: '',
    });
    assert.match(result.bucketName, /^doqyn-dev-t-tenant-x-[a-f0-9]{12}$/);
  });

  it('resolveR2AppEnv mapeia production para prod', () => {
    process.env.APP_ENV = 'production';
    assert.equal(resolveR2AppEnv(), 'prod');
  });

  it('identifica bucket legado doqyn-t-*', () => {
    assert.equal(isLegacyTenantBucketName('doqyn-t-73dcc57ebaf7'), true);
    assert.equal(
      isLegacyTenantBucketName('doqyn-dev-t-alpha-consultoria-73dcc57ebaf7'),
      false,
    );
  });

  it('getTenantBucketName usa padrão amigável em per_tenant', () => {
    const bucket = getTenantBucketName('company_dev', {
      bucketPrefix: 'doqyn',
      bucketMode: 'per_tenant',
      defaultBucket: 'doqyn-alpha',
      tenantDisplayName: 'DOQYN Dev',
      tenantSlug: 'doqyn-dev',
      env: 'dev',
    });
    assert.match(bucket, /^doqyn-dev-t-doqyn-dev-[a-f0-9]{12}$/);
  });
});

describe('tenant storage registry policy', () => {
  const authProvider = readFileSync(
    join(process.cwd(), 'server/auth/providers/doqynAuthProvider.ts'),
    'utf8',
  );
  const docCtx = readFileSync(
    join(process.cwd(), 'server/tenancy/documentRequestContext.ts'),
    'utf8',
  );
  const provisionerSource = readFileSync(
    join(process.cwd(), 'server/storage/r2/r2BucketProvisioner.ts'),
    'utf8',
  );
  const cleanupSource = readFileSync(
    join(process.cwd(), 'scripts/r2-cleanup-empty-demo-buckets.ts'),
    'utf8',
  );

  it('login/session não chama ensureTenantBucket', () => {
    assert.doesNotMatch(authProvider, /ensureTenantBucket|ensureBucketForStorageScope/);
    assert.doesNotMatch(docCtx, /ensureTenantBucket|ensureBucketForStorageScope/);
  });

  it('ensureBucketForStorageScope usa bucketName explícito', () => {
    assert.match(provisionerSource, /ensureTenantBucketByName/);
    assert.match(provisionerSource, /bucketName: input\.bucketName/);
  });

  it('cleanup exige flag explícita e bloqueia prod', () => {
    assert.match(cleanupSource, /--confirm-r2-cleanup/);
    assert.match(cleanupSource, /production/);
  });
});
