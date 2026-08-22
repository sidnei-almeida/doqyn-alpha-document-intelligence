import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getMongoDatabaseName } from '../../server/db/database.js';

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

function resolveMongoUri(): string {
  if (process.env.MONGODB_URI?.trim()) return process.env.MONGODB_URI.trim();
  const envFile = parseEnvFile(join(process.cwd(), '.env'));
  if (envFile.MONGODB_URI?.trim()) return envFile.MONGODB_URI.trim();
  throw new Error('Demo seed bloqueado: MONGODB_URI não configurada.');
}

export function assertDemoMongoSeedSafe(): { mongoUri: string; databaseName: string } {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed bloqueado: APP_ENV/NODE_ENV=production.');
  }

  const mongoUri = resolveMongoUri();

  if (/prod|production/i.test(mongoUri)) {
    throw new Error('Demo seed bloqueado: MONGODB_URI parece produção.');
  }

  // Valida o mesmo database que getDb() abre — o cliente resolve por MONGODB_DATABASE
  // (fallback doqyn_dev) e ignora o segmento de path da URI.
  const databaseName = getMongoDatabaseName();
  if (/prod|production/i.test(databaseName)) {
    throw new Error(`Demo seed bloqueado: database "${databaseName}" parece produção.`);
  }

  const allowed =
    SAFE_DATABASE_NAMES.has(databaseName) || /(?:^|_)dev(?:$|_)/i.test(databaseName);

  if (!allowed) {
    throw new Error(
      `Demo seed bloqueado: database "${databaseName}" não está na allowlist dev. ` +
        `Allowlist: ${[...SAFE_DATABASE_NAMES].join(', ')}`,
    );
  }

  return { mongoUri, databaseName };
}

export function resolveDemoManifestPath(repoRoot = process.cwd()): string {
  const override = process.env.DOQYN_DEMO_MANIFEST_PATH?.trim();
  if (override) return resolve(override);

  return resolve(repoRoot, '../doqyn-auth-service/.generated/doqyn-demo-seed-manifest.json');
}
