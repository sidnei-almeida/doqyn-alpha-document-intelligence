/**
 * Validação local do fluxo MongoDB + Groq + confirmação.
 * Uso: node scripts/validate-flow.mjs
 * Requer: API em localhost:3001, .env com credenciais configuradas.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const PDF_PATH = resolve(__dirname, 'fixtures/contrato-teste.pdf');

function log(step, ok, detail = '') {
  const icon = ok ? 'OK' : 'FALHA';
  console.log(`[${icon}] ${step}${detail ? ` — ${detail}` : ''}`);
}

async function login() {
  const email = process.env.TEMP_ADMIN_EMAIL;
  const password = process.env.VALIDATION_PASSWORD || process.env.TEMP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Defina TEMP_ADMIN_EMAIL e VALIDATION_PASSWORD (ou TEMP_ADMIN_PASSWORD) no .env');
  }

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const cookie = res.headers.getSetCookie?.()?.[0]?.split(';')[0]
    ?? res.headers.raw?.()['set-cookie']?.[0]?.split(';')[0];

  if (!res.ok || !cookie) {
    const body = await res.text();
    throw new Error(`Login falhou (${res.status}): ${body}`);
  }

  const data = await res.json();
  return { cookie, companyId: data.user?.companyId };
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
    throw new Error(`analyze-pdf falhou (${res.status}): ${data.message || JSON.stringify(data)}`);
  }

  return data;
}

async function confirmAnalysis(cookie, analysis) {
  const res = await fetch(`${API_BASE}/api/documents/confirm-analysis`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(analysis),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`confirm-analysis falhou (${res.status}): ${data.message || JSON.stringify(data)}`);
  }

  return data;
}

async function verifyMongo(collections) {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não configurada');

  const dbName = (await import('../server/db/database.ts')).getMongoDatabaseName();

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const counts = {};
  for (const name of collections) {
    counts[name] = await db.collection(name).countDocuments();
  }

  await client.close();
  return { dbName, counts };
}

async function main() {
  const results = {
    dbSetup: null,
    login: false,
    analyze: false,
    confirm: false,
    mongo: null,
    unauthenticatedBlocked: false,
  };

  try {
    const { cookie, companyId } = await login();
    results.login = true;
    log('Login autenticado', true, `companyId=${companyId}`);

    const unauthRes = await fetch(`${API_BASE}/api/ai/analyze-pdf`, { method: 'POST' });
    results.unauthenticatedBlocked = unauthRes.status === 401;
    log('analyze-pdf bloqueia sem auth', results.unauthenticatedBlocked, `status=${unauthRes.status}`);

    const analysis = await analyzePdf(cookie);
    results.analyze = Boolean(analysis.jobId && analysis.fileHash);
    log(
      'analyze-pdf',
      results.analyze,
      `status=${analysis.status}, fileHash=${analysis.fileHash?.slice(0, 12)}...`,
    );

    if (analysis.status !== 'completed') {
      log('confirm-analysis', false, `análise em ${analysis.status} — confirmação não testada`);
    } else {
      const saved = await confirmAnalysis(cookie, analysis);
      results.confirm = Boolean(saved.documentId && saved.versionId);
      log(
        'confirm-analysis',
        results.confirm,
        `documentId=${saved.documentId}, code=${saved.documentCode}`,
      );
    }

    const mongo = await verifyMongo([
      'document_classes',
      'document_rules',
      'documents',
      'document_versions',
      'processing_jobs',
      'audit_logs',
    ]);
    results.mongo = mongo;
    log('MongoDB collections', true, `${mongo.dbName}: ${JSON.stringify(mongo.counts)}`);

    const chunksExist = await verifyMongo(['document_chunks']).then((r) => r.counts.document_chunks > 0);
    log('document_chunks ausente', !chunksExist);

    console.log('\n--- Resumo ---');
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.login && results.analyze && results.unauthenticatedBlocked ? 0 : 1);
  } catch (error) {
    console.error('\nErro na validação:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
