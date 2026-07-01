import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  getR2ConfigFromEnv,
  getStorageConfig,
  isR2StorageConfigured,
  isR2StorageEnabled,
  validateR2Endpoint,
} from '../server/storage/storageConfig.ts';

const ORIGINAL_ENV = { ...process.env };

describe('r2 storage config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('validateR2Endpoint aceita endpoint sem sufixo de bucket', () => {
    assert.equal(
      validateR2Endpoint(
        'https://abc123.r2.cloudflarestorage.com',
        'abc123',
      ),
      true,
    );
    assert.equal(
      validateR2Endpoint(
        'https://abc123.r2.cloudflarestorage.com/doqyn-alpha',
        'abc123',
      ),
      false,
    );
  });

  it('getStorageConfig reconhece STORAGE_PROVIDER=r2 e carrega r2 config', () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'abc123';
    process.env.R2_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    process.env.R2_DEFAULT_BUCKET = 'doqyn-alpha';
    process.env.R2_BUCKET_MODE = 'per_tenant';
    process.env.R2_BUCKET_PREFIX = 'doqyn';
    process.env.R2_KEY_PREFIX = 'documents';
    process.env.R2_REGION = 'auto';
    process.env.R2_ACCESS_KEY_ID = 'runtime-key';
    process.env.R2_SECRET_ACCESS_KEY = 'runtime-secret';
    process.env.R2_ADMIN_ACCESS_KEY_ID = 'admin-key';
    process.env.R2_ADMIN_SECRET_ACCESS_KEY = 'admin-secret';

    const config = getStorageConfig();
    assert.equal(config.provider, 'r2');
    assert.equal(config.r2?.defaultBucket, 'doqyn-alpha');
    assert.equal(config.r2?.bucketMode, 'per_tenant');
    assert.equal(isR2StorageEnabled(), true);
    assert.equal(isR2StorageConfigured(), true);
  });

  it('getR2ConfigFromEnv aceita R2_BUCKET legado como fallback de defaultBucket', () => {
    process.env.R2_ACCOUNT_ID = 'abc123';
    process.env.R2_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    process.env.R2_BUCKET = 'doqyn-alpha';

    const r2 = getR2ConfigFromEnv();
    assert.equal(r2?.defaultBucket, 'doqyn-alpha');
  });
});
