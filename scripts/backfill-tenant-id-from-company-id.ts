import 'dotenv/config';
import { SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import { resolveSharedCollections } from '../server/tenancy/tenantStorage.js';

/**
 * Copia `companyId` para `tenantId` onde só o alias legado existe.
 *
 * O escopo de tenant empresarial passou a filtrar só por `tenantId` (ver
 * `server/tenancy/documentOwnership.ts`). Toda gravação atual põe os dois campos com o mesmo valor,
 * então só registro de antes disso fica invisível sem este passo.
 *
 * Simulação por padrão: conta e não grava. `--apply` grava. Em banco cujo nome contém `prod`,
 * gravar exige também `--allow-production`, para que um `.env` apontado para o lugar errado não
 * vire escrita em produção.
 *
 * Idempotente: o filtro só casa registro sem `tenantId`, e depois de gravado ele deixa de casar.
 */

const LEGACY_FILTER = {
  tenantId: { $exists: false },
  companyId: { $exists: true, $nin: [null, ''] },
};

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply'),
    allowProduction: argv.includes('--allow-production'),
  };
}

async function main() {
  const { apply, allowProduction } = parseArgs(process.argv.slice(2));

  if (!isMongoNativeConfigured()) {
    console.error('MongoDB não configurado (MONGODB_URI ausente).');
    process.exitCode = 1;
    return;
  }

  const dbName = getMongoDatabaseName();
  const looksProduction = /prod/i.test(dbName);
  console.log(`Banco: ${dbName} — modo: ${apply ? 'GRAVAR' : 'simulação'}`);

  if (apply && looksProduction && !allowProduction) {
    console.error('ABORTADO: banco parece de produção. Repita com --allow-production se for isso.');
    process.exitCode = 1;
    return;
  }

  const db = await getDb();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const names = [
    ...new Set([
      ...Object.values(resolveSharedCollections()).filter(
        (name): name is string => typeof name === 'string' && name.length > 0,
      ),
      ...Object.values(SHARED_APP_COLLECTIONS),
    ]),
  ].sort();

  let total = 0;
  for (const name of names) {
    if (!existing.has(name)) continue;
    const collection = db.collection(name);
    const count = await collection.countDocuments(LEGACY_FILTER);
    if (count === 0) continue;
    total += count;

    if (!apply) {
      console.log(`  ${name}: ${count} registro(s) só com companyId`);
      continue;
    }

    const result = await collection.updateMany(LEGACY_FILTER, [
      { $set: { tenantId: '$companyId' } },
    ]);
    console.log(`  ${name}: ${result.modifiedCount} de ${count} atualizado(s)`);
  }

  console.log(total === 0 ? 'Nenhum registro legado.' : `Total: ${total}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeMongoConnection());
