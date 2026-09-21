import 'dotenv/config';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant, MongoTenantUsage } from '../server/db/types.js';
import {
  readStorageQuotaBytes,
  setTenantStoredBytes,
  sumTenantStoredBytes,
} from '../server/services/tenantStorageQuotaService.js';

/**
 * Reconcilia o contador de bytes de cada tenant contra a soma real das versões guardadas.
 *
 * O contador é `$inc` no caminho quente, e por isso pode divergir: uma confirmação que guardou o
 * arquivo mas perdeu a soma, uma correção feita direto no banco, um tenant criado antes do contador
 * existir. Divergir para cima faz o portão pagar um `$group` a mais e se realinhar sozinho; divergir
 * para baixo abre espaço que o plano não deu. Este script fecha os dois casos de uma vez.
 *
 * Uso:
 *   npx tsx scripts/reconcile-tenant-storage.ts            relatório, não grava nada
 *   npx tsx scripts/reconcile-tenant-storage.ts --apply    grava o valor real em quem divergiu
 */
const apply = process.argv.slice(2).includes('--apply');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unit]}`;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MongoDB não configurado.');
    process.exitCode = 1;
    return;
  }

  const quotaBytes = readStorageQuotaBytes();
  console.log(`\nBanco: ${getMongoDatabaseName()}`);
  console.log(`Teto por tenant: ${quotaBytes === null ? 'sem cota' : formatBytes(quotaBytes)}`);
  console.log(apply ? 'Modo: gravando\n' : 'Modo: só relatório (use --apply para gravar)\n');

  const db = await getDb();
  const tenants = await db
    .collection<MongoTenant & { usage?: MongoTenantUsage }>(REGISTRY_COLLECTIONS.tenants)
    .find({}, { projection: { tenantId: 1, tenantType: 1, 'usage.storedBytes': 1 } })
    .toArray();

  let diverged = 0;
  let overQuota = 0;

  for (const tenant of tenants) {
    const counted = tenant.usage?.storedBytes ?? 0;
    const actual = await sumTenantStoredBytes(tenant.tenantId);

    if (counted !== actual) {
      diverged += 1;
      const direction = counted > actual ? 'a mais' : 'a menos';
      console.log(
        `  ${tenant.tenantId} (${tenant.tenantType}): contador ${formatBytes(counted)}, real ` +
          `${formatBytes(actual)} — ${formatBytes(Math.abs(counted - actual))} ${direction}`,
      );
      if (apply) await setTenantStoredBytes(tenant.tenantId, actual);
    }

    if (quotaBytes !== null && actual > quotaBytes) {
      overQuota += 1;
      console.log(`  ${tenant.tenantId}: ACIMA DO TETO — ${formatBytes(actual)}`);
    }
  }

  console.log('\n──────────────────────────────────────────────────────────────────────────');
  console.log(`tenants conferidos   ${tenants.length}`);
  console.log(`contador divergente  ${diverged}${apply ? ' (gravados)' : ''}`);
  console.log(`acima do teto        ${overQuota}`);
  console.log('──────────────────────────────────────────────────────────────────────────\n');

  console.log(diverged === 0 ? 'OK.\n' : apply ? 'Reconciliado.\n' : 'Rode com --apply.\n');
}

await main().finally(() => closeMongoConnection());
