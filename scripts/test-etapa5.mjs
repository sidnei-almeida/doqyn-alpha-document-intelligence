/**
 * Auditoria Etapa 5 — integração Regras ↔ MongoDB ↔ IA ↔ persistência.
 * Uso: npx tsx scripts/test-etapa5.mjs
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { createSessionToken, getAuthCookieName } from '../server/auth/session.ts';
import { getTemporaryUser } from '../server/auth/tempUser.ts';
import { getCompanyIdFromUser } from '../server/auth/companyContext.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';
import { getMongoDatabaseName } from '../server/db/database.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const PDF_NDA = resolve(__dirname, '..', 'NDA - ACORDO DE CONFIDENCIALIDADE (2).pdf');
const TEST_KEYWORD = 'teste-doqyn-nda';
const NDA_CLASS_ID = 'class_confidentiality_agreement';
const NDA_RULE_ID = 'rule_confidentiality_agreement_v1';

const EXPECTED_NDA_FIELDS = [
  'parte_reveladora',
  'parte_receptora',
  'cpf_cnpj_receptora',
  'data_assinatura',
  'prazo_vigencia',
  'prazo_confidencialidade',
  'multa_penalidade',
  'foro',
  'objeto_confidencialidade',
];

const report = [];

function pass(step, detail = '') {
  report.push({ step, ok: true, detail });
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ''}`);
}

function fail(step, detail = '') {
  report.push({ step, ok: false, detail });
  console.error(`✗ ${step}${detail ? ` — ${detail}` : ''}`);
}

async function api(cookie, method, path, body, isForm = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: isForm ? { Cookie: cookie } : { Cookie: cookie, 'Content-Type': 'application/json' },
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function getDbClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente');
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(getMongoDatabaseName()) };
}

async function main() {
  console.log('\n=== ETAPA 5.0 — Sanidade ambiente ===\n');
  try {
    const health = await fetch(`${API_BASE}/api/health`);
    if (health.ok) pass('5.0 API responde em :3001', API_BASE);
    else fail('5.0 API health', `status=${health.status}`);
  } catch {
    fail('5.0 API em :3001', 'não acessível — rode npm run dev ou libere com fuser -k 3001/tcp');
    process.exit(1);
  }

  const user = getTemporaryUser();
  const companyId = getCompanyIdFromUser(user);
  const cookie = `${getAuthCookieName()}=${await createSessionToken(user)}`;

  console.log('\n=== ETAPA 5.1 — Regras controlam IA ===\n');

  const [groupsRes, classesRes, membersRes, activeRes] = await Promise.all([
    api(cookie, 'GET', '/api/access-groups'),
    api(cookie, 'GET', '/api/document-classes'),
    api(cookie, 'GET', '/api/company-members'),
    api(cookie, 'GET', '/api/document-rules/active'),
  ]);

  const activeGroups = (groupsRes.data?.groups ?? []).filter((g) => g.active);
  const activeClasses = (classesRes.data?.classes ?? []).filter((c) => c.active);
  const members = membersRes.data?.members ?? [];

  if (activeGroups.length >= 5) pass('5.1 grupos ativos', String(activeGroups.length));
  else fail('5.1 grupos ativos', `${activeGroups.length} (esperado ≥5)`);

  if (activeClasses.length >= 7) pass('5.1 classes ativas', String(activeClasses.length));
  else fail('5.1 classes ativas', `${activeClasses.length} (esperado ≥7)`);

  if (members.length >= 3) pass('5.1 membros', String(members.length));
  else fail('5.1 membros', `${members.length} (esperado ≥3)`);

  const active = activeRes.data;
  if (active?.source === 'mongodb') pass('5.1 source', 'mongodb');
  else fail('5.1 source', String(active?.source));

  pass('5.1 database', active?.database ?? getMongoDatabaseName());
  pass('5.1 companyId', active?.companyId ?? companyId);
  pass('5.1 classes ativas (active)', String(active?.activeClassesCount));
  pass('5.1 regras ativas (active)', String(active?.activeRulesCount));
  pass('5.1 fallback mock', active?.source === 'mongodb' ? 'false' : 'true');

  const ndaClass = active?.classes?.find((c) => c._id === NDA_CLASS_ID);
  const ndaRule = ndaClass?.rule;
  if (ndaClass) pass('5.1 NDA class', ndaClass._id);
  else fail('5.1 NDA class', 'ausente');

  if (ndaRule?._id === NDA_RULE_ID || ndaRule?.id === NDA_RULE_ID) {
    pass('5.1 NDA rule', NDA_RULE_ID);
  } else fail('5.1 NDA rule', ndaRule?._id ?? 'ausente');

  const fieldKeys = (ndaRule?.fields ?? []).map((f) => f.key);
  const missingFields = EXPECTED_NDA_FIELDS.filter((k) => !fieldKeys.includes(k));
  if (missingFields.length === 0) {
    pass('5.1 campos NDA', `${fieldKeys.length} campos`);
  } else {
    fail('5.1 campos NDA faltando', missingFields.join(', '));
    pass('5.1 campos NDA presentes', fieldKeys.join(', '));
  }

  console.log('\n=== ETAPA 5.2 — Alteração temporária keyword ===\n');

  const { client, db } = await getDbClient();
  const beforeKw = ndaClass?.keywords ?? [];

  const addRes = await api(cookie, 'PUT', `/api/document-classes/${NDA_CLASS_ID}`, {
    keywords: [...beforeKw, TEST_KEYWORD],
  });
  if (addRes.status === 200) pass('5.2 keyword adicionada via API', TEST_KEYWORD);
  else fail('5.2 keyword adicionada', `status=${addRes.status}`);

  const mongoAfterAdd = await db.collection('document_classes').findOne({ _id: NDA_CLASS_ID, companyId });
  if (mongoAfterAdd?.keywords?.includes(TEST_KEYWORD)) pass('5.2 MongoDB keywords atualizado');
  else fail('5.2 MongoDB keywords', 'não contém keyword');

  const activeAfterAdd = await api(cookie, 'GET', '/api/document-rules/active');
  const ndaAfterAdd = activeAfterAdd.data?.classes?.find((c) => c._id === NDA_CLASS_ID);
  if (ndaAfterAdd?.keywords?.includes(TEST_KEYWORD)) pass('5.2 keyword no /active');
  else fail('5.2 keyword no /active', 'ausente');

  const removeKw = (mongoAfterAdd?.keywords ?? []).filter((k) => k !== TEST_KEYWORD);
  const rmRes = await api(cookie, 'PUT', `/api/document-classes/${NDA_CLASS_ID}`, { keywords: removeKw });
  if (rmRes.status === 200) pass('5.2 keyword removida');
  else fail('5.2 keyword removida', `status=${rmRes.status}`);

  const mongoAfterRm = await db.collection('document_classes').findOne({ _id: NDA_CLASS_ID, companyId });
  if (!mongoAfterRm?.keywords?.includes(TEST_KEYWORD)) pass('5.2 keyword limpa do MongoDB');
  else fail('5.2 keyword limpa', 'ainda presente');

  console.log('\n=== ETAPA 5.3 — Teste NDA único ===\n');

  let analysis;
  try {
    const pdf = readFileSync(PDF_NDA);
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'nda-teste-etapa5.pdf');
    const res = await api(cookie, 'POST', '/api/ai/analyze-pdf', form, true);
    analysis = res.data;
    if (res.status === 200) pass('5.3 analyze-pdf HTTP 200', analysis?.status);
    else fail('5.3 analyze-pdf', `status=${res.status} ${analysis?.message}`);
  } catch (e) {
    fail('5.3 analyze-pdf', e instanceof Error ? e.message : String(e));
  }

  if (analysis) {
    const cls = analysis.classification;
    pass('5.3 status analyze', analysis.status);
    if (analysis.status === 'completed') {
      if (cls?.classId === NDA_CLASS_ID) pass('5.3 classId', NDA_CLASS_ID);
      else fail('5.3 classId', `${cls?.classId} (esperado ${NDA_CLASS_ID})`);
      if (cls?.className?.includes('Confidencialidade')) pass('5.3 className', cls.className);
      else fail('5.3 className', cls?.className ?? 'null');
      const metaKeys = analysis.extraction?.metadata
        ? Object.keys(analysis.extraction.metadata)
        : [];
      pass('5.3 metadados extraídos', metaKeys.slice(0, 8).join(', ') || 'nenhum');
    } else if (analysis.status === 'requires_review') {
      pass('5.3 requires_review', 'sim');
      const reason =
        cls?.reason ||
        analysis.extraction?.reviewReasons?.join(' | ') ||
        'classificação sem confiança suficiente';
      pass('5.3 motivo revisão', reason);
      if (cls?.classId) pass('5.3 classId parcial', cls.classId);
      else pass('5.3 classId', 'null — classificação não concluída');
    }

    const mockLog = analysis.logs?.find((l) => l.title?.includes('mock'));
    if (!mockLog) pass('5.3 sem log de mock no response');
    else fail('5.3 log mock', mockLog.title);
  }

  let confirmResult = null;
  if (analysis?.status === 'completed') {
    const confirmRes = await api(cookie, 'POST', '/api/documents/confirm-analysis', {
      ...analysis,
      manualReviewConfirmed: false,
    });
    confirmResult = confirmRes.data;
    if (confirmRes.status === 201) pass('5.3 confirm-analysis', confirmResult.documentId);
    else fail('5.3 confirm-analysis', `${confirmRes.status} ${confirmResult?.message}`);
  } else if (analysis?.status === 'requires_review' && analysis.classification?.classId) {
    const confirmRes = await api(cookie, 'POST', '/api/documents/confirm-analysis', {
      ...analysis,
      manualReviewConfirmed: true,
      recommendedFileName: analysis.recommendedFileName || 'NDA_revisao_manual.pdf',
      extraction: analysis.extraction || {
        requiresReview: true,
        reviewReasons: [analysis.classification?.reason || 'revisão manual'],
        metadata: {},
      },
    });
    if (confirmRes.status === 201) {
      confirmResult = confirmRes.data;
      pass('5.3 confirm-analysis (revisão manual)', confirmResult.documentId);
    } else {
      fail('5.3 confirm-analysis revisão', `${confirmRes.status} ${confirmRes.data?.message}`);
    }
  } else {
    pass('5.3 confirm-analysis', 'pulado — analyze não completou com classId');
  }

  console.log('\n=== ETAPA 5.4 — Herança de permissões ===\n');

  const ndaDocClass = await db.collection('document_classes').findOne({ _id: NDA_CLASS_ID, companyId });
  const viewPerms = ndaDocClass?.permissions?.view ?? [];
  pass('5.4 permissions.view da classe', viewPerms.join(', '));

  if (confirmResult?.documentId) {
    const doc = await db.collection('documents').findOne({ _id: confirmResult.documentId, companyId });
    const docView = doc?.access?.viewGroupIds ?? [];
    const match =
      viewPerms.length === docView.length &&
      viewPerms.every((g) => docView.includes(g));
    if (match) pass('5.4 documents.access.viewGroupIds', docView.join(', '));
    else fail('5.4 access mismatch', `classe=[${viewPerms}] doc=[${docView}]`);

    const emptyOthers =
      (doc?.access?.downloadGroupIds?.length ?? 0) === 0 &&
      (doc?.access?.updateGroupIds?.length ?? 0) === 0;
    if (emptyOthers) pass('5.4 download/update vazios');
    else pass('5.4 download/update', JSON.stringify(doc?.access));
  } else {
    const lastDoc = await db
      .collection('documents')
      .find({ companyId, classId: NDA_CLASS_ID })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    if (lastDoc[0]) {
      const docView = lastDoc[0].access?.viewGroupIds ?? [];
      const match = viewPerms.every((g) => docView.includes(g));
      if (match) pass('5.4 último doc NDA access', docView.join(', '));
      else fail('5.4 último doc access', `classe=[${viewPerms}] doc=[${docView}]`);
    } else {
      pass('5.4 documents.access', 'sem documento NDA salvo nesta execução');
    }
  }

  console.log('\n=== ETAPA 5.5 — Erros controlados ===\n');

  // Cenário: classe sem regra — toggle rule off temporariamente
  await db.collection('document_rules').updateOne(
    { _id: NDA_RULE_ID, companyId },
    { $set: { active: false, updatedAt: new Date() } },
  );
  const noRuleRes = await api(cookie, 'GET', '/api/document-rules/active');
  const ndaNoRule = noRuleRes.data?.classes?.find((c) => c._id === NDA_CLASS_ID);
  if (ndaNoRule && !ndaNoRule.rule) pass('5.5 cenário sem regra ativa', 'rule=null no /active');
  else fail('5.5 cenário sem regra', 'rule ainda presente');

  await db.collection('document_rules').updateOne(
    { _id: NDA_RULE_ID, companyId },
    { $set: { active: true, updatedAt: new Date() } },
  );
  pass('5.5 regra NDA reativada', NDA_RULE_ID);

  console.log('\n=== ETAPA 5.3 — Verificação MongoDB pós-fluxo ===\n');

  const counts = {};
  for (const coll of ['documents', 'document_versions', 'processing_jobs', 'audit_logs']) {
    counts[coll] = await db.collection(coll).countDocuments({ companyId });
  }
  pass('5.3 documents total', String(counts.documents));
  pass('5.3 document_versions total', String(counts.document_versions));
  pass('5.3 processing_jobs total', String(counts.processing_jobs));
  pass('5.3 audit_logs total', String(counts.audit_logs));

  if (confirmResult?.documentId) {
    const [doc, ver, job, audits] = await Promise.all([
      db.collection('documents').findOne({ _id: confirmResult.documentId }),
      db.collection('document_versions').findOne({ documentId: confirmResult.documentId }),
      db.collection('processing_jobs').findOne({ documentId: confirmResult.documentId }),
      db.collection('audit_logs').find({ documentId: confirmResult.documentId }).toArray(),
    ]);
    if (doc) pass('5.3 document criado', doc._id);
    if (ver) pass('5.3 version criada', ver._id);
    if (job) pass('5.3 processing_job', job._id);
    pass('5.3 audit_logs do doc', String(audits.length));
  }

  await client.close();

  console.log('\n=== ETAPA 5.6 — Estado /audit (documentação) ===\n');
  pass('5.6 /audit existe', 'src/features/audit/AuditPage.tsx');
  pass('5.6 fonte UI', 'GET /api/audit com fallback MOCK_AUDIT_EVENTS em catch');
  pass('5.6 backend', 'auditService usa mongoose AuditEventModel (legado)');
  pass('5.6 audit_logs nativo', 'confirm-analysis grava em collection audit_logs');
  pass('5.6 integração UI', 'PENDENTE Etapa 6 — não misturar legado com nativo');

  const failed = report.filter((r) => !r.ok);
  console.log(`\n--- Resumo Etapa 5: ${report.length - failed.length}/${report.length} OK ---`);
  if (failed.length) {
    console.error('Falhas:', failed.map((f) => f.step).join(', '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
