#!/usr/bin/env tsx
/**
 * Auditoria de buckets R2 — somente leitura.
 * npm run r2:audit-buckets
 */
import 'dotenv/config';
import { ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getDb } from '../server/db/mongoClient.js';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import type { MongoTenant } from '../server/db/types.js';
import { createR2AdminClient } from '../server/storage/r2/r2Clients.js';
import {
  buildTenantBucketName,
  isLegacyTenantBucketName,
  resolveR2AppEnv,
} from '../server/storage/r2/r2BucketNaming.js';
import { getR2ConfigFromEnv } from '../server/storage/storageConfig.js';
import { listReferencedBucketNames } from '../server/services/tenantStorageConfigService.js';

type BucketAuditStatus =
  | 'ok'
  | 'legacy_name'
  | 'orphan_empty'
  | 'orphan_has_objects'
  | 'missing_registry'
  | 'mismatch';

type BucketAuditRow = {
  bucketName: string;
  status: BucketAuditStatus;
  objectCount: number;
  totalSizeBytes: number;
  tenantId?: string;
  tenantDisplayName?: string;
  registryBucketName?: string;
  expectedBucketName?: string;
  notes?: string;
};

async function countBucketObjects(
  client: ReturnType<typeof createR2AdminClient>,
  bucketName: string,
): Promise<{ objectCount: number; totalSizeBytes: number }> {
  let objectCount = 0;
  let totalSizeBytes = 0;
  let token: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const item of response.Contents ?? []) {
      objectCount += 1;
      totalSizeBytes += item.Size ?? 0;
    }
    token = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (token);

  return { objectCount, totalSizeBytes };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const r2Config = getR2ConfigFromEnv();
  if (!r2Config) {
    console.error('FAIL: Configuração R2 ausente.');
    process.exit(1);
  }

  const adminClient = createR2AdminClient(r2Config);
  const listResponse = await adminClient.send(new ListBucketsCommand({}));
  const cloudBuckets = (listResponse.Buckets ?? [])
    .map((bucket) => bucket.Name)
    .filter((name): name is string => Boolean(name?.trim()));

  const db = await getDb();
  const tenants = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).find({}).toArray();
  const referenced = await listReferencedBucketNames();
  const env = resolveR2AppEnv();

  const tenantByRegistryBucket = new Map<string, MongoTenant>();
  for (const tenant of tenants) {
    if (tenant.storage?.bucketName) {
      tenantByRegistryBucket.set(tenant.storage.bucketName, tenant);
    }
  }

  const rows: BucketAuditRow[] = [];

  for (const bucketName of cloudBuckets.sort()) {
    const { objectCount, totalSizeBytes } = await countBucketObjects(adminClient, bucketName);
    const tenant = tenantByRegistryBucket.get(bucketName);
    const isDoqynBucket =
      bucketName.startsWith('doqyn-') || bucketName === r2Config.defaultBucket;

    if (!isDoqynBucket) {
      continue;
    }

    let status: BucketAuditStatus = 'ok';
    let expectedBucketName: string | undefined;
    let notes: string | undefined;

    if (tenant) {
      expectedBucketName = buildTenantBucketName({
        tenantId: tenant.tenantId,
        tenantDisplayName: tenant.displayName,
        tenantSlug: tenant.slug,
        env,
      }).bucketName;

      if (isLegacyTenantBucketName(bucketName)) {
        status = 'legacy_name';
        notes = 'Bucket legado — mantido se já em uso.';
      } else if (tenant.storage?.bucketName && tenant.storage.bucketName !== bucketName) {
        status = 'mismatch';
        notes = 'Nome no registry difere do bucket na nuvem.';
      } else if (tenant.storage?.bucketName !== expectedBucketName && !isLegacyTenantBucketName(bucketName)) {
        status = 'ok';
        notes = 'Bucket amigável salvo no registry.';
      }
    } else if (!referenced.has(bucketName)) {
      status = objectCount === 0 ? 'orphan_empty' : 'orphan_has_objects';
      notes = 'Bucket não referenciado por tenant registry nem document_versions.';
    } else {
      status = 'missing_registry';
      notes = 'Referenciado em documentos mas sem registry de tenant.';
    }

    rows.push({
      bucketName,
      status,
      objectCount,
      totalSizeBytes,
      tenantId: tenant?.tenantId,
      tenantDisplayName: tenant?.displayName,
      registryBucketName: tenant?.storage?.bucketName,
      expectedBucketName,
      notes,
    });
  }

  console.log('DOQYN R2 Bucket Audit');
  console.log(`Ambiente: ${env}`);
  console.log(`Buckets DOQYN encontrados: ${rows.length}`);
  console.log('');

  for (const row of rows) {
    console.log(`- ${row.bucketName}`);
    console.log(`  status: ${row.status}`);
    console.log(`  objetos: ${row.objectCount} (${formatBytes(row.totalSizeBytes)})`);
    if (row.tenantId) console.log(`  tenant: ${row.tenantId} (${row.tenantDisplayName ?? '—'})`);
    if (row.registryBucketName) console.log(`  registry: ${row.registryBucketName}`);
    if (row.expectedBucketName && row.expectedBucketName !== row.bucketName) {
      console.log(`  esperado (novo padrão): ${row.expectedBucketName}`);
    }
    if (row.notes) console.log(`  nota: ${row.notes}`);
    console.log('');
  }

  const summary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log('Resumo:', summary);
  console.log('Nenhum bucket foi alterado ou removido.');
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
