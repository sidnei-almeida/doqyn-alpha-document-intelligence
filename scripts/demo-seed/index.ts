#!/usr/bin/env tsx
import 'dotenv/config';
import { closeMongoConnection } from '../../server/db/mongoClient.js';
import { assertDemoMongoSeedSafe, resolveDemoManifestPath } from './guard.js';
import { readDemoSeedManifest } from './manifest.js';
import { provisionDemoTenants } from './provisionTenants.js';

async function main() {
  assertDemoMongoSeedSafe();

  const manifestPath = resolveDemoManifestPath();
  const manifest = readDemoSeedManifest(manifestPath);
  const result = await provisionDemoTenants(manifest);

  console.log('Demo seed Mongo concluído:');
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  Tenant operador (login admin): ${result.devTenantId}`);
  console.log(`  Operadores sincronizados: ${result.devOperatorEmails.join(', ')}`);
  console.log(`  Tenants provisionados: ${result.provisionedTenants.length}`);
  for (const tenantId of result.provisionedTenants) {
    console.log(`    - ${tenantId}`);
  }
  console.log(`  Governança documental: ${result.governanceSeededTenants.length} tenant(s)`);
  console.log('  Membros pendentes demo: aguardam aprovação no auth (não sincronizados).');
}

main()
  .catch((error) => {
    console.error('Erro no demo seed Mongo:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeMongoConnection();
  });
