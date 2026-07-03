#!/usr/bin/env tsx
/**
 * Remove buckets vazios órfãos em dev/test — destrutivo, exige confirmação explícita.
 * npm run r2:cleanup-empty-demo-buckets -- --confirm-r2-cleanup
 */
import 'dotenv/config';
import { DeleteBucketCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import { createR2AdminClient } from '../server/storage/r2/r2Clients.js';
import { resolveR2AppEnv } from '../server/storage/r2/r2BucketNaming.js';
import { getR2ConfigFromEnv } from '../server/storage/storageConfig.js';
import {
  headBucketExists,
  listReferencedBucketNames,
} from '../server/services/tenantStorageConfigService.js';

async function isBucketEmpty(
  client: ReturnType<typeof createR2AdminClient>,
  bucketName: string,
): Promise<boolean> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const response = await client.send(
    new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }),
  );
  return (response.KeyCount ?? 0) === 0 && (response.Contents?.length ?? 0) === 0;
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--confirm-r2-cleanup');
  const env = resolveR2AppEnv();

  if (env === 'prod') {
    console.error('FAIL: Cleanup não permitido em production.');
    process.exit(1);
  }

  const r2Config = getR2ConfigFromEnv();
  if (!r2Config) {
    console.error('FAIL: Configuração R2 ausente.');
    process.exit(1);
  }

  const adminClient = createR2AdminClient(r2Config);
  const referenced = await listReferencedBucketNames();
  const listResponse = await adminClient.send(new ListBucketsCommand({}));
  const candidates = (listResponse.Buckets ?? [])
    .map((bucket) => bucket.Name)
    .filter((name): name is string => {
      if (!name?.trim()) return false;
      if (name === r2Config.defaultBucket) return false;
      if (!name.startsWith('doqyn-t-') && !name.startsWith(`doqyn-${env}-`)) return false;
      if (referenced.has(name)) return false;
      return true;
    });

  const plan: string[] = [];
  for (const bucketName of candidates) {
    const empty = await isBucketEmpty(adminClient, bucketName);
    if (empty) plan.push(bucketName);
  }

  console.log('DOQYN R2 Cleanup — buckets vazios órfãos');
  console.log(`Ambiente: ${env}`);
  console.log(`Candidatos para remoção: ${plan.length}`);

  if (plan.length === 0) {
    console.log('Nada a remover.');
    return;
  }

  for (const bucket of plan) {
    console.log(`  - ${bucket}`);
  }

  if (!confirmed) {
    console.log('');
    console.log('Dry-run apenas. Para executar:');
    console.log('  npm run r2:cleanup-empty-demo-buckets -- --confirm-r2-cleanup');
    return;
  }

  for (const bucketName of plan) {
    const stillEmpty = await isBucketEmpty(adminClient, bucketName);
    if (!stillEmpty) {
      console.log(`SKIP (não vazio): ${bucketName}`);
      continue;
    }

    const exists = await headBucketExists(bucketName);
    if (!exists) {
      console.log(`SKIP (ausente): ${bucketName}`);
      continue;
    }

    await adminClient.send(new DeleteBucketCommand({ Bucket: bucketName }));
    console.log(`REMOVED: ${bucketName}`);
  }
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
