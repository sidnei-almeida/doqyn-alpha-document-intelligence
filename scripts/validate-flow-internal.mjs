/**
 * Validação interna do fluxo (sem senha em texto plano).
 * Gera sessão JWT diretamente como o login faria.
 * Uso: node scripts/validate-flow-internal.mjs
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { createSessionToken, getAuthCookieName } from '../server/auth/session.ts';
import { getTemporaryUser } from '../server/auth/tempUser.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const PDF_PATH = resolve(__dirname, 'fixtures/contrato-teste.pdf');

function log(step, ok, detail = '') {
  console.log(`[${ok ? 'OK' : 'FALHA'}] ${step}${detail ? ` — ${detail}` : ''}`);
}

async function getSessionCookie() {
  const user = getTemporaryUser();
  const token = await createSessionToken(user);
  return `${getAuthCookieName()}=${token}`;
}

async function analyzePdf(cookie) {
  const pdf = readFileSync(PDF_PATH);
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'contrato-teste.pdf');

  const res = await fetch(`${API_BASE}/api/ai/analyze-pdf`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`analyze-pdf (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function confirmAnalysis(cookie, analysis) {
  const res = await fetch(`${API_BASE}/api/documents/confirm-analysis`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(analysis),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`confirm-analysis (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function inspectMongo() {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não configurada');

  const dbName = getMongoDatabaseName();

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const names = [
    'document_classes',
    'document_rules',
    'documents',
    'document_versions',
    'processing_jobs',
    'audit_logs',
    'document_chunks',
  ];

  const counts = {};
  for (const name of names) {
    counts[name] = await db.collection(name).countDocuments();
  }

  const indexes = {};
  for (const name of ['document_classes', 'document_rules']) {
    indexes[name] = (await db.collection(name).indexes()).map((i) => i.name);
  }

  await client.close();
  return { dbName, counts, indexes };
}

async function main() {
  const user = getTemporaryUser();
  log('companyId da sessão', true, user.companyId);

  const unauth = await fetch(`${API_BASE}/api/ai/analyze-pdf`, { method: 'POST' });
  log('analyze-pdf exige autenticação', unauth.status === 401, `status=${unauth.status}`);

  const cookie = await getSessionCookie();
  log('sessão JWT gerada', true);

  const analysis = await analyzePdf(cookie);
  const hashOk = /^[a-f0-9]{64}$/.test(analysis.fileHash || '');
  log('analyze-pdf retornou fileHash SHA256', hashOk, analysis.fileHash?.slice(0, 16) + '...');
  log('analyze-pdf status', true, analysis.status);

  if (analysis.status === 'completed') {
    const saved = await confirmAnalysis(cookie, analysis);
    log('confirm-analysis persistiu', Boolean(saved.documentId), saved.documentCode);
  } else {
    log('confirm-analysis', false, `pulado — status=${analysis.status}`);
  }

  const mongo = await inspectMongo();
  log('MongoDB database', true, mongo.dbName);
  log('document_classes', mongo.counts.document_classes >= 3, String(mongo.counts.document_classes));
  log('document_rules', mongo.counts.document_rules >= 3, String(mongo.counts.document_rules));
  log('documents', mongo.counts.documents >= 1, String(mongo.counts.documents));
  log('document_versions', mongo.counts.document_versions >= 1, String(mongo.counts.document_versions));
  log('processing_jobs', mongo.counts.processing_jobs >= 1, String(mongo.counts.processing_jobs));
  log('audit_logs', mongo.counts.audit_logs >= 1, String(mongo.counts.audit_logs));
  log('document_chunks ausente', mongo.counts.document_chunks === 0);
  log('índices document_classes', mongo.indexes.document_classes.length >= 2, mongo.indexes.document_classes.join(', '));

  console.log('\n--- Contagens MongoDB ---');
  console.log(JSON.stringify(mongo, null, 2));
}

main().catch((error) => {
  console.error('Erro:', error instanceof Error ? error.message : error);
  process.exit(1);
});
