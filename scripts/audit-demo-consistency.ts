#!/usr/bin/env tsx
/**
 * Verifica alinhamento entre auth-service demo seed e Mongo alpha.
 * Uso: npm run audit:demo-consistency
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeMongoConnection } from '../server/db/mongoClient.js';
import { resolveDemoManifestPath } from './demo-seed/guard.js';
import { readDemoSeedManifest } from './demo-seed/manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const EXPECTED_TENANTS = [
  'company_dev',
  'company_alpha_consultoria',
  'company_horizonte_logistica',
  'company_metalprime_industrias',
  'company_nexserv_tecnologia',
];

type CheckResult = { ok: boolean; message: string };

function check(label: string, ok: boolean, detail: string): CheckResult {
  const message = `${ok ? '✓' : '✗'} ${label}: ${detail}`;
  if (!ok) console.error(message);
  else console.log(message);
  return { ok, message };
}

async function main() {
  const results: CheckResult[] = [];

  const manifestPath = resolveDemoManifestPath();
  if (!existsSync(manifestPath)) {
    results.push(
      check(
        'manifest auth',
        false,
        `não encontrado em ${manifestPath}. Rode npm run dev:seed:demo no auth-service.`,
      ),
    );
    process.exit(1);
  }

  const manifest = readDemoSeedManifest(manifestPath);
  results.push(check('manifest auth', true, manifestPath));
  results.push(
    // A chave `globalAdmin` do manifest é contrato cross-repo e ficou; a conta por trás dela deixou
    // de ser administrador de plataforma e virou o admin da empresa demo. O check afirma também que
    // ela NÃO carrega papel de plataforma — é o que impede o seed de recriar o que a fase removeu.
    check(
      'admin da empresa demo',
      manifest.globalAdmin.email === 'rafael.mendes@doqyn.dev' &&
        manifest.globalAdmin.status === 'active' &&
        manifest.globalAdmin.roles.every((role) => role === 'company_admin' || role === 'user'),
      `${manifest.globalAdmin.email} (${manifest.globalAdmin.tenantId}) — ${manifest.globalAdmin.roles.join(', ')}`,
    ),
  );

  for (const tenantId of EXPECTED_TENANTS) {
    const inManifest =
      tenantId === manifest.globalAdmin.tenantId ||
      manifest.companies.some((c) => c.tenantId === tenantId);
    results.push(
      check(`tenant no manifest: ${tenantId}`, inManifest, inManifest ? 'presente' : 'ausente'),
    );
  }

  const db = await getDb();
  const mongoTenants = await db.collection('tenants').find({}).project({ tenantId: 1 }).toArray();
  const mongoTenantIds = new Set(mongoTenants.map((t) => String(t.tenantId)));

  for (const tenantId of EXPECTED_TENANTS) {
    results.push(
      check(
        `tenant no Mongo: ${tenantId}`,
        mongoTenantIds.has(tenantId),
        mongoTenantIds.has(tenantId) ? 'presente' : 'ausente — rode npm run dev:seed:demo',
      ),
    );
  }

  for (const tenantId of EXPECTED_TENANTS) {
    const categoriesCol = `document_categories_${tenantId}`;
    const categories = await db.listCollections({ name: categoriesCol }).toArray();
    const hasCategories = categories.length > 0;
    let count = 0;
    if (hasCategories) {
      count = await db.collection(categoriesCol).countDocuments({});
    }
    results.push(
      check(
        `categorias ${tenantId}`,
        hasCategories && count > 0,
        hasCategories ? `${count} categoria(s)` : 'coleção ausente',
      ),
    );
  }

  const authAccountsPath = resolve(
    dirname(manifestPath),
    'doqyn-demo-accounts.md',
  );
  results.push(
    check(
      'relatório de contas demo',
      existsSync(authAccountsPath),
      authAccountsPath,
    ),
  );

  const authHealthHint = join(repoRoot, '..', 'doqyn-auth-service');
  if (existsSync(authHealthHint)) {
    console.log(`\nDica: cd ${authHealthHint} && npm run audit:auth-health`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} verificação(ões) falharam.`);
    process.exit(1);
  }

  console.log(`\nTodas as ${results.length} verificações passaram.`);
}

main()
  .catch((error) => {
    console.error('audit:demo-consistency falhou:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeMongoConnection();
  });
