#!/usr/bin/env node
/**
 * Valida sincronização de variáveis Auth ↔ Alpha (pré-requisito P0 de deploy).
 * Nunca imprime valores secretos — só status (ok / missing / drift).
 *
 * Uso:
 *   npm run env:auth-sync
 *   node scripts/env-auth-sync-check.mjs
 *   node scripts/env-auth-sync-check.mjs --auth-env ../doqyn-auth-service/.env
 *   node scripts/env-auth-sync-check.mjs --alpha-env .env --auth-env /path/to/auth/.env
 *
 * Exit 0 = ok | Exit 1 = drift ou variável crítica ausente
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALPHA_ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {
    alphaEnv: resolve(ALPHA_ROOT, '.env'),
    authEnv: resolve(ALPHA_ROOT, '../doqyn-auth-service/.env'),
    strictProduction: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--alpha-env' && argv[i + 1]) out.alphaEnv = resolve(argv[++i]);
    else if (a === '--auth-env' && argv[i + 1]) out.authEnv = resolve(argv[++i]);
    else if (a === '--auth-dir' && argv[i + 1]) out.authEnv = resolve(argv[++i], '.env');
    else if (a === '--strict-production') out.strictProduction = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return null;
  const vars = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function normalizeOrigin(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`.replace(/\/$/, '');
  } catch {
    return String(url || '')
      .trim()
      .replace(/\/$/, '');
  }
}

function originsList(csv) {
  return String(csv || '')
    .split(',')
    .map((s) => normalizeOrigin(s.trim()))
    .filter(Boolean);
}

function statusEqual(a, b) {
  if (!a && !b) return 'missing';
  if (!a || !b) return 'missing';
  return a === b ? 'ok' : 'drift';
}

function printHelp() {
  console.log(`Uso: node scripts/env-auth-sync-check.mjs [opções]

Opções:
  --alpha-env <path>   .env do Alpha (default: ./.env)
  --auth-env <path>    .env do Auth (default: ../doqyn-auth-service/.env)
  --auth-dir <path>    pasta do auth-service (usa <path>/.env)
  --strict-production  falha se chaves forem placeholders fracos de exemplo

Pares verificados:
  Alpha.DOQYN_AUTH_INTERNAL_API_KEY == Auth.DOQYN_INTERNAL_API_KEY
  Alpha.DOQYN_APP_INTERNAL_API_KEY  == Auth.DOQYN_APP_INTERNAL_API_KEY
  Alpha.DOQYN_AUTH_COOKIE_NAME      == Auth.SESSION_COOKIE_NAME
  Alpha.AUTH_PROVIDER + VITE_AUTH_PROVIDER == doqyn_auth
  Auth.ALLOWED_ORIGINS contém Alpha.DOQYN_PUBLIC_APP_URL
  (recomendado) Alpha.DOQYN_PUBLIC_APP_URL == Auth.DOQYN_APP_PUBLIC_URL
  (recomendado) URLs base Auth↔Alpha coerentes
`);
}

const WEAK_PLACEHOLDERS = new Set([
  '',
  'change-me',
  'CHANGE_ME',
  'changeme',
  'dev-app-internal-api-key-change-in-production',
  'change-me-base64-32-bytes',
]);

function isWeak(value) {
  const v = String(value || '').trim();
  if (WEAK_PLACEHOLDERS.has(v)) return true;
  if (v.length > 0 && v.length < 16) return true;
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const alpha = parseEnvFile(args.alphaEnv);
  const auth = parseEnvFile(args.authEnv);

  console.log('=== DoQyn env sync: Auth ↔ Alpha ===\n');
  console.log(`Alpha .env: ${args.alphaEnv} ${alpha ? '(lido)' : '(AUSENTE)'}`);
  console.log(`Auth  .env: ${args.authEnv} ${auth ? '(lido)' : '(AUSENTE)'}\n`);

  if (!alpha || !auth) {
    console.error('FAIL: um ou ambos os arquivos .env não existem.');
    console.error('Dica: --auth-dir /caminho/do/doqyn-auth-service');
    process.exit(1);
  }

  /** @type {{name: string, status: string, detail?: string}[]} */
  const rows = [];
  let hardFail = false;
  let softWarn = false;

  const add = (name, status, detail = '') => {
    rows.push({ name, status, detail });
    if (status === 'drift' || status === 'missing' || status === 'fail') hardFail = true;
    if (status === 'warn') softWarn = true;
  };

  // Pares idênticos (críticos)
  const equalPairs = [
    ['DOQYN_AUTH_INTERNAL_API_KEY', 'DOQYN_INTERNAL_API_KEY', 'Bearer Alpha→Auth (/internal/*)', true],
    ['DOQYN_APP_INTERNAL_API_KEY', 'DOQYN_APP_INTERNAL_API_KEY', 'Bearer Auth→Alpha (provision/sync)', true],
    ['DOQYN_AUTH_COOKIE_NAME', 'SESSION_COOKIE_NAME', 'Nome do cookie HttpOnly', false],
  ];

  for (const [alphaKey, authKey, why, checkWeak] of equalPairs) {
    const av = (alpha[alphaKey] ?? '').trim();
    const bv = (auth[authKey] ?? '').trim();
    const st = statusEqual(av, bv);
    if (st === 'ok' && checkWeak && args.strictProduction && (isWeak(av) || isWeak(bv))) {
      add(`${alphaKey} ↔ ${authKey}`, 'fail', `${why} — placeholder fraco (strict-production)`);
      continue;
    }
    if (st === 'ok' && checkWeak && isWeak(av)) {
      add(`${alphaKey} ↔ ${authKey}`, 'warn', `${why} — valor fraco/placeholder (ok em dev)`);
      continue;
    }
    add(`${alphaKey} ↔ ${authKey}`, st === 'ok' ? 'ok' : st, why);
  }

  // Providers
  const authProvider = (alpha.AUTH_PROVIDER ?? '').trim().toLowerCase();
  const viteProvider = (alpha.VITE_AUTH_PROVIDER ?? '').trim().toLowerCase();
  if (authProvider === 'doqyn_auth' && viteProvider === 'doqyn_auth') {
    add('AUTH_PROVIDER + VITE_AUTH_PROVIDER', 'ok', 'ambos doqyn_auth');
  } else {
    add(
      'AUTH_PROVIDER + VITE_AUTH_PROVIDER',
      'fail',
      `esperado doqyn_auth / doqyn_auth; atual: ${authProvider || '(vazio)'} / ${viteProvider || '(vazio)'}`,
    );
  }

  // URLs públicas / CORS
  const publicApp = (alpha.DOQYN_PUBLIC_APP_URL ?? '').trim();
  const authPublic = (auth.DOQYN_APP_PUBLIC_URL ?? '').trim();
  const allowed = originsList(auth.ALLOWED_ORIGINS);
  const publicOrigin = normalizeOrigin(publicApp);

  if (!publicApp) {
    add('DOQYN_PUBLIC_APP_URL', 'missing', 'Alpha precisa da URL pública do FE');
  } else if (!allowed.includes(publicOrigin)) {
    add(
      'ALLOWED_ORIGINS ⊇ DOQYN_PUBLIC_APP_URL',
      'fail',
      `Auth.ALLOWED_ORIGINS deve incluir ${publicOrigin}`,
    );
  } else {
    add('ALLOWED_ORIGINS ⊇ DOQYN_PUBLIC_APP_URL', 'ok', publicOrigin);
  }

  if (publicApp && authPublic) {
    const st = statusEqual(normalizeOrigin(publicApp), normalizeOrigin(authPublic));
    add(
      'DOQYN_PUBLIC_APP_URL ↔ DOQYN_APP_PUBLIC_URL',
      st === 'ok' ? 'ok' : 'warn',
      st === 'ok' ? 'origens alinhadas' : 'recomendado manter iguais (convites/OG)',
    );
    if (st !== 'ok') softWarn = true;
  } else if (!authPublic) {
    add('DOQYN_APP_PUBLIC_URL (Auth)', 'warn', 'vazio — convites podem cair em ALLOWED_ORIGINS[0]');
  }

  // Bases de serviço (complementares)
  const authBase = (alpha.DOQYN_AUTH_BASE_URL ?? '').trim();
  const appBase = (auth.DOQYN_APP_BASE_URL ?? '').trim();
  if (!authBase) add('DOQYN_AUTH_BASE_URL', 'missing', 'Alpha → URL do Auth');
  else add('DOQYN_AUTH_BASE_URL', 'ok', 'definido (não imprime valor)');

  if (!appBase) add('DOQYN_APP_BASE_URL (Auth)', 'missing', 'Auth → URL da API Alpha');
  else add('DOQYN_APP_BASE_URL (Auth)', 'ok', 'definido (não imprime valor)');

  // Redis prefix isolation (shared Redis)
  const alphaRedis = (alpha.REDIS_KEY_PREFIX ?? 'doqyn:alpha:').trim() || 'doqyn:alpha:';
  const authRedis = (auth.REDIS_KEY_PREFIX ?? 'doqyn:auth:').trim() || 'doqyn:auth:';
  if (alphaRedis === authRedis) {
    add(
      'REDIS_KEY_PREFIX Alpha ≠ Auth',
      'warn',
      `ambos="${alphaRedis}" — risco de colisão em Redis compartilhado (use doqyn:alpha: / doqyn:auth:)`,
    );
  } else {
    add('REDIS_KEY_PREFIX Alpha ≠ Auth', 'ok', 'prefixos distintos');
  }

  // Tabela
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('CHECK', 52)} ${pad('STATUS', 8)} DETAIL`);
  console.log('-'.repeat(100));
  for (const r of rows) {
    const icon =
      r.status === 'ok' ? 'OK  ' : r.status === 'warn' ? 'WARN' : r.status === 'missing' ? 'MISS' : 'FAIL';
    console.log(`${pad(r.name, 52)} ${pad(icon, 8)} ${r.detail || r.status}`);
  }

  console.log('\n---');
  if (hardFail) {
    console.error('RESULT: FAIL — corrija drifts/ausências antes do deploy.');
    console.error('Doc: docs/ENV_SYNC.md');
    process.exit(1);
  }
  if (softWarn) {
    console.log('RESULT: OK com avisos — revise WARNs antes de produção.');
    process.exit(0);
  }
  console.log('RESULT: OK — pares críticos sincronizados.');
  process.exit(0);
}

main();
