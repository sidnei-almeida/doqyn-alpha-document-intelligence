#!/usr/bin/env tsx
/**
 * Reset DEV do MongoDB do app principal.
 * NÃO toca R2, auth-service nem .env.
 *
 * Dry-run (padrão):
 *   npm run dev:reset:mongo
 *
 * Executar reset:
 *   npm run dev:reset:mongo -- --confirm-reset-doqyn-dev
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { getMongoDatabaseName } from '../server/db/database.js';

const CONFIRM_FLAG = '--confirm-reset-doqyn-dev';

const SAFE_DATABASE_NAMES = new Set([
  'doqyn_dev',
  'doqyn-dev',
  'doqyn_alpha',
  'doqyn_test',
  'doqyn_local',
]);

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[trimmed.slice(0, eq).trim()] = value;
  }
  return vars;
}

function maskUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = `${parsed.username.slice(0, 3)}***`;
    return parsed.toString();
  } catch {
    return uri.replace(/:([^:@/]+)@/, ':***@');
  }
}

function assertNotProductionEnv(): void {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Reset bloqueado: APP_ENV/NODE_ENV=production.');
  }
}

function assertSafeDatabaseName(databaseName: string): void {
  if (/prod|production/i.test(databaseName)) {
    throw new Error(`Reset bloqueado: database "${databaseName}" parece produção.`);
  }

  const allowed =
    SAFE_DATABASE_NAMES.has(databaseName) || /(?:^|_)dev(?:$|_)/i.test(databaseName);

  if (!allowed) {
    throw new Error(
      `Reset bloqueado: database "${databaseName}" não está na allowlist dev. ` +
        `Allowlist: ${[...SAFE_DATABASE_NAMES].join(', ')}`,
    );
  }
}

function assertSafeMongoUri(uri: string, databaseName: string): void {
  if (/prod|production/i.test(uri) && !/dev/i.test(uri)) {
    throw new Error('Reset bloqueado: MONGODB_URI parece produção.');
  }

  let hostname = '';
  try {
    hostname = new URL(uri).hostname.toLowerCase();
  } catch {
    throw new Error('MONGODB_URI inválida.');
  }

  const localHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  const devCluster = hostname.includes('dev');

  if (!localHost && !devCluster) {
    throw new Error(
      `Reset bloqueado: host Mongo "${hostname}" não é local nem cluster dev identificável.`,
    );
  }

  assertSafeDatabaseName(databaseName);
}

async function auditDatabase(client: MongoClient, databaseName: string) {
  const db = client.db(databaseName);
  const collections = await db.listCollections().toArray();
  const rows: Array<{ collection: string; count: number }> = [];

  for (const entry of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const count = await db.collection(entry.name).estimatedDocumentCount();
    rows.push({ collection: entry.name, count });
  }

  return rows;
}

async function main(): Promise<void> {
  const envFile = process.env.ENV_FILE?.trim() || '.env';
  Object.assign(process.env, parseEnvFile(envFile));

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI não configurada.');
  }

  const databaseName = getMongoDatabaseName();
  const confirmed = process.argv.includes(CONFIRM_FLAG);

  assertNotProductionEnv();
  assertSafeMongoUri(uri, databaseName);

  console.log('================================================================================');
  console.log('DOQYN — PLANO DE RESET MongoDB (app principal)');
  console.log('================================================================================');
  console.log(`Modo: ${confirmed ? 'EXECUÇÃO DESTRUTIVA' : 'DRY-RUN (somente leitura)'}`);
  console.log(`Database alvo: ${databaseName}`);
  console.log(`URI (mascarada): ${maskUri(uri)}`);
  console.log('R2: NÃO será alterado');
  console.log('Auth-service/Postgres: NÃO será alterado');
  console.log('');

  const client = new MongoClient(uri);
  await client.connect();

  const collections = await auditDatabase(client, databaseName);
  const totalDocs = collections.reduce((sum, row) => sum + row.count, 0);

  console.log(`Collections encontradas: ${collections.length}`);
  console.log(`Documentos estimados (total): ${totalDocs}`);
  console.log('');

  if (collections.length === 0) {
    console.log('(nenhuma collection — database já vazio ou inexistente)');
  } else {
    for (const row of collections) {
      console.log(`  - ${row.collection}: ${row.count}`);
    }
  }

  console.log('');
  console.log('Ação planejada: db.dropDatabase() no database acima.');
  console.log('Isso remove tenants, documentos, versões, jobs, audit logs, regras e demais dados.');
  console.log('');

  if (!confirmed) {
    console.log('DRY-RUN concluído. Nada foi apagado.');
    console.log(`Para executar: npm run dev:reset:mongo -- ${CONFIRM_FLAG}`);
    await client.close();
    return;
  }

  console.log('⚠️  EXECUTANDO RESET DESTRUTIVO...');
  await client.db(databaseName).dropDatabase();
  console.log(`OK: database "${databaseName}" removido.`);

  const after = await auditDatabase(client, databaseName);
  console.log(`Collections restantes: ${after.length}`);

  await client.close();

  console.log('');
  console.log('Próximo passo sugerido (opcional): npm run db:setup');
  console.log('Ou testar signup/login do zero sem seed Mongo.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: ${message}`);
  process.exit(1);
});
