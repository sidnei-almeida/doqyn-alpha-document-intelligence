#!/usr/bin/env node
/**
 * Limpeza de dados legados MongoDB — dry-run por padrão.
 *
 * Dry-run (padrão):
 *   npm run mongo:cleanup:dry-run
 *
 * Execução real (requer confirmação explícita):
 *   DOQYN_MONGO_CLEANUP_CONFIRM="DROP_LEGACY_DOQYN_DATA" npm run mongo:cleanup:execute
 *
 * Opcional para cluster production-like:
 *   DOQYN_MONGO_CLEANUP_ALLOW_PRODUCTION="yes"
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import {
  SYSTEM_DATABASES,
  classifyCollection,
  classifyDatabase,
  getActiveDatabaseName,
  getLegacyDatabaseName,
  isNeverDropCollection,
  listDropEntireDatabaseCandidates,
  listLegacyDropTargets,
} from './mongo-cleanup/classification.mjs';
import {
  isProductionLikeUri,
  maskUri,
  requireMongoUri,
} from './mongo-cleanup/env.mjs';

const CONFIRM_VALUE = 'DROP_LEGACY_DOQYN_DATA';

function parseArgs() {
  const execute = process.argv.includes('--execute');
  const dryRun = process.argv.includes('--dry-run') || !execute;
  return { dryRun, execute };
}

function assertSafetyGuards({ execute, uri, activeDatabase }) {
  if (!execute) return;

  const confirm = process.env.DOQYN_MONGO_CLEANUP_CONFIRM?.trim();
  if (confirm !== CONFIRM_VALUE) {
    throw new Error(
      `Execução bloqueada. Defina DOQYN_MONGO_CLEANUP_CONFIRM="${CONFIRM_VALUE}" para apagar dados.`,
    );
  }

  if (isProductionLikeUri(uri) && process.env.DOQYN_MONGO_CLEANUP_ALLOW_PRODUCTION !== 'yes') {
    throw new Error(
      'URI ou APP_ENV parecem produção. Defina DOQYN_MONGO_CLEANUP_ALLOW_PRODUCTION=yes se tiver certeza.',
    );
  }

  if (!activeDatabase) {
    throw new Error('Database ativo não confirmado (MONGODB_DATABASE).');
  }
}

async function loadAuditSnapshot(activeDatabase) {
  const auditPath = join(process.cwd(), 'docs/mongo-audit-report.json');
  if (!existsSync(auditPath)) {
    return null;
  }

  const report = JSON.parse(readFileSync(auditPath, 'utf8'));
  if (report.runtime?.activeDatabase !== activeDatabase) {
    console.warn(
      'Aviso: mongo-audit-report.json foi gerado para outro database ativo. Reexecute npm run mongo:audit.',
    );
  }
  return report;
}

async function collectInventory(client, activeDatabase, legacyDatabase) {
  const admin = client.db().admin();
  const { databases: dbList } = await admin.listDatabases();

  const databases = [];
  const collections = [];

  for (const entry of dbList) {
    const dbName = entry.name;
    databases.push({
      name: dbName,
      classification: classifyDatabase(dbName, activeDatabase, legacyDatabase),
    });

    const db = client.db(dbName);
    const colInfos = await db.listCollections().toArray();

    for (const colInfo of colInfos) {
      const name = colInfo.name;
      if (name.startsWith('system.')) continue;

      const classification = classifyCollection(dbName, name, activeDatabase);
      let estimatedDocumentCount = 0;
      try {
        estimatedDocumentCount = await db.collection(name).estimatedDocumentCount();
      } catch {
        estimatedDocumentCount = -1;
      }

      collections.push({ database: dbName, name, classification, estimatedDocumentCount });
    }
  }

  return { databases, collections };
}

function explainRemoval(target) {
  if (SYSTEM_DATABASES.has(target.database)) {
    return 'BLOQUEADO — database de sistema';
  }
  if (target.database !== getActiveDatabaseName() && target.type === 'database') {
    return `Database legado "${target.database}" não é o database ativo do app`;
  }
  if (isNeverDropCollection(target.name)) {
    return 'BLOQUEADO — collection ativa (prefixo company_* ou *_compartilhado ou tenants)';
  }
  if (target.classification === 'legacy_candidate') {
    return 'Collection flat/legada ou access_groups — substituída pelo modelo prefixado/compartilhado';
  }
  if (target.classification === 'unknown_review_required') {
    return 'Revisão manual necessária — não será apagada automaticamente';
  }
  return 'Motivo não classificado';
}

async function main() {
  const { dryRun, execute } = parseArgs();
  const uri = requireMongoUri();
  const activeDatabase = getActiveDatabaseName();
  const legacyDatabase = getLegacyDatabaseName();

  assertSafetyGuards({ execute, uri, activeDatabase });

  console.log('='.repeat(72));
  console.log(execute ? 'MONGO CLEANUP — EXECUÇÃO REAL' : 'MONGO CLEANUP — DRY-RUN');
  console.log('='.repeat(72));
  console.log('URI:', maskUri(uri));
  console.log('Database ativo:', activeDatabase);
  console.log('Database legado:', legacyDatabase);
  console.log('');

  const audit = await loadAuditSnapshot(activeDatabase);
  if (!audit && execute) {
    throw new Error('Execute npm run mongo:audit e npm run mongo:backup antes da limpeza real.');
  }
  if (!audit) {
    console.log('Dica: execute npm run mongo:audit antes para gerar relatório em docs/.');
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const { databases, collections } = await collectInventory(client, activeDatabase, legacyDatabase);

    const dropCollections = listLegacyDropTargets(collections, activeDatabase).filter(
      (c) => c.classification === 'legacy_candidate' && !isNeverDropCollection(c.name),
    );

    const dropDatabases = listDropEntireDatabaseCandidates(databases, activeDatabase, legacyDatabase);

    const blocked = collections.filter((c) => c.classification === 'unknown_review_required');

    console.log('--- AÇÕES PLANEJADAS (collections legadas) ---');
    if (dropCollections.length === 0) {
      console.log('  (nenhuma collection legada elegível para drop)');
    }
    for (const target of dropCollections) {
      console.log(
        `  ${dryRun ? '[DRY-RUN]' : '[DROP]'} ${target.database}.${target.name} — docs≈${target.estimatedDocumentCount}`,
      );
      console.log(`    motivo: ${explainRemoval({ ...target, type: 'collection' })}`);
    }

    console.log('');
    console.log('--- AÇÕES PLANEJADAS (databases inteiros) ---');
    if (dropDatabases.length === 0) {
      console.log('  (nenhum database inteiro elegível — ex.: doqyn_alpha se classificado legado)');
    }
    for (const db of dropDatabases) {
      console.log(`  ${dryRun ? '[DRY-RUN]' : '[DROP DB]'} database "${db.name}"`);
      console.log(`    motivo: ${explainRemoval({ database: db.name, type: 'database' })}`);
    }

    console.log('');
    console.log('--- BLOQUEADAS / REVISÃO MANUAL ---');
    for (const item of blocked) {
      console.log(`  [KEEP/REVIEW] ${item.database}.${item.name} — ${item.classification}`);
    }

    console.log('');
    console.log('--- NUNCA APAGAR (proteção em código) ---');
    console.log('  admin, local, config');
    console.log('  tenants, documents_*_company_*, *_compartilhado');
    console.log(`  database ativo inteiro: ${activeDatabase}`);

    if (dryRun) {
      console.log('');
      console.log('Dry-run concluído. Nenhum dado foi alterado.');
      console.log(
        `Para executar: DOQYN_MONGO_CLEANUP_CONFIRM="${CONFIRM_VALUE}" npm run mongo:cleanup:execute`,
      );
      return;
    }

    console.log('');
    console.log('Iniciando remoção...');

    for (const target of dropCollections) {
      if (SYSTEM_DATABASES.has(target.database) || isNeverDropCollection(target.name)) {
        console.log(`  SKIP ${target.database}.${target.name}`);
        continue;
      }
      await client.db(target.database).dropCollection(target.name);
      console.log(`  DROPPED collection ${target.database}.${target.name}`);
    }

    for (const db of dropDatabases) {
      if (SYSTEM_DATABASES.has(db.name) || db.name === activeDatabase) {
        console.log(`  SKIP database ${db.name}`);
        continue;
      }
      await client.db(db.name).dropDatabase();
      console.log(`  DROPPED database ${db.name}`);
    }

    console.log('');
    console.log('Limpeza concluída. Valide o app e o Atlas Data Explorer.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Falha:', error instanceof Error ? error.message : error);
  process.exit(1);
});
