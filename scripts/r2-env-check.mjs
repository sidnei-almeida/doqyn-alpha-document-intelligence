#!/usr/bin/env node
/**
 * Diagnóstico seguro das variáveis R2 — nunca imprime valores secretos.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED_VARS = [
  'STORAGE_PROVIDER',
  'R2_BUCKET_MODE',
  'R2_DEFAULT_BUCKET',
  'R2_BUCKET_PREFIX',
  'R2_KEY_PREFIX',
  'R2_ACCOUNT_ID',
  'R2_ENDPOINT',
  'R2_REGION',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ADMIN_ACCESS_KEY_ID',
  'R2_ADMIN_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_ADMIN_API_TOKEN',
];

const SENSITIVE_VARS = new Set([
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ADMIN_ACCESS_KEY_ID',
  'R2_ADMIN_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_ADMIN_API_TOKEN',
]);

const LEGACY_R2_VARS = ['R2_BUCKET'];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return null;
  const vars = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function statusFor(key, value) {
  if (value === undefined) return 'MISSING';
  if (value === '') return 'EMPTY';
  return SENSITIVE_VARS.has(key) ? 'OK' : 'OK';
}

function validateEndpoint(endpoint, accountId) {
  if (!endpoint) return { status: 'MISSING', detail: 'endpoint ausente' };
  if (/\/doqyn-alpha\/?$/.test(endpoint)) {
    return { status: 'INVALID', detail: 'endpoint não deve terminar com /doqyn-alpha' };
  }
  if (!/^https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/?$/i.test(endpoint)) {
    return { status: 'INVALID', detail: 'formato esperado: https://<ACCOUNT_ID>.r2.cloudflarestorage.com' };
  }
  if (accountId && !endpoint.includes(accountId)) {
    return { status: 'INVALID', detail: 'accountId não corresponde ao endpoint' };
  }
  return { status: 'OK', detail: 'formato válido' };
}

function scanViteR2InCode(rootDir = '.') {
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|vue)$/.test(entry.name)) {
        if (entry.name === 'r2-env-check.mjs') continue;
        const content = readFileSync(full, 'utf8');
        if (/import\.meta\.env\.VITE_[A-Z0-9_]*R2|process\.env\.VITE_[A-Z0-9_]*R2/.test(content)) {
          hits.push(full);
        }
      }
    }
  };
  walk(rootDir);
  return hits;
}

function main() {
  const envPath = process.env.ENV_FILE?.trim() || '.env';
  const env = parseEnvFile(envPath);
  let exitCode = 0;

  console.log('DOQYN — auditoria segura de variáveis R2\n');

  if (!env) {
    console.log(`MISSING: arquivo ${envPath} não encontrado`);
    process.exit(1);
  }

  console.log(`Arquivo: ${envPath} (encontrado)\n`);

  for (const key of EXPECTED_VARS) {
    const st = statusFor(key, env[key]);
    if (st === 'MISSING' || st === 'EMPTY') exitCode = 1;
    console.log(`${st === 'OK' ? 'OK' : st}: ${key}`);
  }

  for (const legacy of LEGACY_R2_VARS) {
    if (env[legacy] !== undefined) {
      console.log(`WARN: variável legada detectada (${legacy}) — use R2_DEFAULT_BUCKET`);
      exitCode = 1;
    }
  }

  console.log('\nValidações de valor (sem expor segredos):');

  const checks = [
    ['STORAGE_PROVIDER=r2', env.STORAGE_PROVIDER === 'r2'],
    ['R2_BUCKET_MODE=per_tenant', env.R2_BUCKET_MODE === 'per_tenant'],
    ['R2_REGION=auto', env.R2_REGION === 'auto'],
    ['R2_DEFAULT_BUCKET=doqyn-alpha', env.R2_DEFAULT_BUCKET === 'doqyn-alpha'],
    ['R2_KEY_PREFIX=documents', env.R2_KEY_PREFIX === 'documents'],
    ['R2_BUCKET_PREFIX=doqyn', env.R2_BUCKET_PREFIX === 'doqyn'],
  ];

  for (const [label, ok] of checks) {
    console.log(`${ok ? 'OK' : 'INVALID'}: ${label}`);
    if (!ok) exitCode = 1;
  }

  const endpointCheck = validateEndpoint(env.R2_ENDPOINT, env.R2_ACCOUNT_ID);
  console.log(`${endpointCheck.status}: R2_ENDPOINT (${endpointCheck.detail})`);
  if (endpointCheck.status !== 'OK') exitCode = 1;

  const viteEnvKeys = Object.keys(env).filter((k) => k.startsWith('VITE_') && k.includes('R2'));
  console.log('\nFrontend (VITE_):');
  if (viteEnvKeys.length === 0) {
    console.log('OK: nenhuma variável VITE_*R2* no .env');
  } else {
    for (const key of viteEnvKeys) {
      console.log(`INVALID: ${key} — chaves R2 não podem usar prefixo VITE_`);
      exitCode = 1;
    }
  }

  const codeHits = scanViteR2InCode();
  if (codeHits.length === 0) {
    console.log('OK: nenhuma referência VITE_*R2* no código');
  } else {
    for (const file of codeHits) {
      console.log(`INVALID: referência VITE_R2 em ${file}`);
      exitCode = 1;
    }
  }

  console.log('\nSeparação admin/runtime:');
  const runtimeOk = Boolean(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
  const adminOk = Boolean(
    env.R2_ADMIN_ACCESS_KEY_ID && env.R2_ADMIN_SECRET_ACCESS_KEY && env.CLOUDFLARE_R2_ADMIN_API_TOKEN,
  );
  console.log(`${runtimeOk ? 'OK' : 'MISSING'}: credenciais runtime (R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY)`);
  console.log(
    `${adminOk ? 'OK' : 'MISSING'}: credenciais admin (R2_ADMIN_* + CLOUDFLARE_R2_ADMIN_API_TOKEN)`,
  );
  if (!runtimeOk || !adminOk) exitCode = 1;

  console.log('\nBackend:');
  const providerImplemented = existsSync('server/storage/r2/r2StorageProvider.ts');
  console.log(
    `${providerImplemented ? 'OK' : 'MISSING'}: provider R2 implementado em server/storage/r2/`,
  );
  if (!providerImplemented) exitCode = 1;

  process.exit(exitCode);
}

main();
