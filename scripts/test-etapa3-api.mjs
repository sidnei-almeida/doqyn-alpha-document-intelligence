/**
 * Auditoria Etapa 3 — endpoints admin (grupos, membros, classes, regras).
 * Uso: npx tsx scripts/test-etapa3-api.mjs
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { createSessionToken, getAuthCookieName } from '../server/auth/session.ts';
import { getTemporaryUser } from '../server/auth/tempUser.ts';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { getCompanyIdFromUser } from '../server/auth/companyContext.ts';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = getMongoDatabaseName();

const results = [];

function unwrapList(data, keys) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function unwrapEntity(data, keys) {
  for (const key of keys) {
    if (data?.[key]) return data[key];
  }
  return data;
}

function entityId(entity) {
  return entity?.id ?? entity?._id ?? null;
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(cookie, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

async function main() {
  const user = getTemporaryUser();
  const cookie = `${getAuthCookieName()}=${await createSessionToken(user)}`;

  const state = {
    groupId: null,
    memberId: 'member_pending',
    classId: null,
    ruleId: null,
  };

  // 1. GET access-groups
  {
    const { status, data } = await api(cookie, 'GET', '/api/access-groups');
    const groups = unwrapList(data, ['groups']);
    if (status === 200 && groups.length >= 5) pass('1. GET /api/access-groups', `${groups.length} grupos`);
    else fail('1. GET /api/access-groups', `status=${status} count=${groups.length}`);
  }

  // 2. POST access-groups (nome único por execução)
  {
    const suffix = Date.now().toString(36).slice(-4);
    const { status, data } = await api(cookie, 'POST', '/api/access-groups', {
      name: `Qualidade ${suffix}`,
      color: 'blue',
    });
    const group = unwrapEntity(data, ['group']);
    state.groupId = entityId(group);
    if (status === 201 && state.groupId) pass('2. POST /api/access-groups', state.groupId);
    else fail('2. POST /api/access-groups', `status=${status} ${JSON.stringify(data)}`);
  }

  // 3. PUT access-groups/:id
  if (state.groupId) {
    const { status, data } = await api(cookie, 'PUT', `/api/access-groups/${state.groupId}`, {
      name: 'Qualidade QA',
      color: 'green',
    });
    const group = unwrapEntity(data, ['group']);
    if (status === 200 && (group?.name === 'Qualidade QA' || group?.color === 'green')) {
      pass('3. PUT /api/access-groups/:id', group?.name ?? 'ok');
    } else fail('3. PUT /api/access-groups/:id', `status=${status}`);
  } else fail('3. PUT /api/access-groups/:id', 'sem groupId');

  // 4. PATCH toggle-active
  if (state.groupId) {
    const off = await api(cookie, 'PATCH', `/api/access-groups/${state.groupId}/toggle-active`);
    const on = await api(cookie, 'PATCH', `/api/access-groups/${state.groupId}/toggle-active`);
    const group = unwrapEntity(on.data, ['group']);
    const active = group?.active;
    if (off.status === 200 && on.status === 200 && typeof active === 'boolean') {
      pass('4. PATCH /api/access-groups/:id/toggle-active', `active=${active}`);
    } else fail('4. PATCH toggle-active', `off=${off.status} on=${on.status}`);
  } else fail('4. PATCH toggle-active', 'sem groupId');

  // 5. GET company-members
  {
    const { status, data } = await api(cookie, 'GET', '/api/company-members');
    const members = unwrapList(data, ['members']);
    if (status === 200 && members.length >= 3) pass('5. GET /api/company-members', `${members.length} membros`);
    else fail('5. GET /api/company-members', `status=${status} count=${members.length}`);
  }

  // 6. PUT company-members/:id/groups
  {
    const { status, data } = await api(
      cookie,
      'PUT',
      `/api/company-members/${state.memberId}/groups`,
      { groupIds: ['group_juridico', 'group_financeiro'] },
    );
    const member = unwrapEntity(data, ['member']);
    const groups = member?.groupIds ?? [];
    if (status === 200 && groups.includes('group_juridico')) {
      pass('6. PUT /api/company-members/:id/groups', groups.join(', '));
    } else fail('6. PUT groups', `status=${status}`);
  }

  // 7. PATCH status pending → active → blocked
  {
    const toActive = await api(cookie, 'PATCH', `/api/company-members/${state.memberId}/status`, {
      status: 'active',
    });
    const toBlocked = await api(cookie, 'PATCH', `/api/company-members/${state.memberId}/status`, {
      status: 'blocked',
    });
    const member = unwrapEntity(toBlocked.data, ['member']);
    if (toActive.status === 200 && toBlocked.status === 200 && member?.status === 'blocked') {
      pass('7. PATCH /api/company-members/:id/status', 'active → blocked');
    } else fail('7. PATCH status', `active=${toActive.status} blocked=${toBlocked.status}`);
    await api(cookie, 'PATCH', `/api/company-members/${state.memberId}/status`, { status: 'pending' });
    await api(cookie, 'PUT', `/api/company-members/${state.memberId}/groups`, { groupIds: [] });
  }

  // 8. GET document-classes
  {
    const { status, data } = await api(cookie, 'GET', '/api/document-classes');
    const classes = unwrapList(data, ['classes']);
    if (status === 200 && classes.length >= 7) pass('8. GET /api/document-classes', `${classes.length} classes`);
    else fail('8. GET /api/document-classes', `status=${status} count=${classes.length}`);
  }

  // 9. POST document-classes
  {
    const suffix = Date.now().toString(36).slice(-4);
    const { status, data } = await api(cookie, 'POST', '/api/document-classes', {
      name: `Relatório Técnico ${suffix}`,
      description: 'Relatórios técnicos, laudos e documentos de análise.',
      keywords: ['relatório técnico', 'laudo', 'análise técnica'],
      negativeKeywords: ['nota fiscal', 'boleto'],
      iconKey: 'file-text',
      color: 'neutral',
    });
    const docClass = unwrapEntity(data, ['class']);
    state.classId = entityId(docClass);
    if (status === 201 && state.classId) pass('9. POST /api/document-classes', state.classId);
    else fail('9. POST /api/document-classes', `status=${status}`);
  }

  // 10. PUT document-classes/:id
  if (state.classId) {
    const { status, data } = await api(cookie, 'PUT', `/api/document-classes/${state.classId}`, {
      description: 'Laudos e relatórios atualizados.',
      keywords: ['relatório', 'laudo técnico'],
      negativeKeywords: ['boleto'],
    });
    const docClass = unwrapEntity(data, ['class']);
    if (status === 200 && docClass?.description?.includes('atualizados')) {
      pass('10. PUT /api/document-classes/:id', 'descrição atualizada');
    } else fail('10. PUT document-classes', `status=${status}`);
  } else fail('10. PUT document-classes', 'sem classId');

  // 11. PUT permissions
  if (state.classId) {
    const { status, data } = await api(
      cookie,
      'PUT',
      `/api/document-classes/${state.classId}/permissions`,
      { viewGroupIds: ['group_juridico', 'group_diretoria'] },
    );
    const docClass = unwrapEntity(data, ['class']);
    const view = docClass?.permissions?.view ?? [];
    if (status === 200 && view.includes('group_juridico')) {
      pass('11. PUT /permissions', view.join(', '));
    } else fail('11. PUT permissions', `status=${status}`);
  } else fail('11. PUT permissions', 'sem classId');

  // 12. PUT notifications
  if (state.classId) {
    const { status, data } = await api(
      cookie,
      'PUT',
      `/api/document-classes/${state.classId}/notifications`,
      { notifyOnUpdate: true, notifyGroups: ['group_diretoria'] },
    );
    const docClass = unwrapEntity(data, ['class']);
    if (status === 200 && docClass?.notifyOnUpdate === true) {
      pass('12. PUT /notifications', `notifyGroups=${(docClass.notifyGroups ?? []).join(',')}`);
    } else fail('12. PUT notifications', `status=${status}`);
  } else fail('12. PUT notifications', 'sem classId');

  // 13. GET document-rules
  {
    const { status, data } = await api(cookie, 'GET', '/api/document-rules');
    const rules = unwrapList(data, ['rules']);
    if (status === 200 && rules.length >= 7) pass('13. GET /api/document-rules', `${rules.length} regras`);
    else fail('13. GET /api/document-rules', `status=${status} count=${rules.length}`);
  }

  // 14. POST document-rules
  if (state.classId) {
    const { status, data } = await api(cookie, 'POST', '/api/document-rules', {
      classId: state.classId,
      version: 1,
      active: true,
      namingTemplate: 'Relatorio_{parte_receptora}_{data}',
      minimumConfidence: 0.7,
      onLowConfidence: 'requires_review',
      fields: [
        {
          key: 'parte_receptora',
          label: 'Parte receptora',
          type: 'string',
          required: true,
          aliases: ['parte receptora', 'receptor'],
          description: 'Pessoa ou empresa que recebe as informações.',
        },
        {
          key: 'data',
          label: 'Data',
          type: 'date',
          required: false,
          aliases: ['data do documento'],
        },
      ],
    });
    const rule = unwrapEntity(data, ['rule']);
    state.ruleId = entityId(rule);
    if (status === 201 && state.ruleId) pass('14. POST /api/document-rules', state.ruleId);
    else fail('14. POST /api/document-rules', `status=${status} ${JSON.stringify(data)}`);
  } else fail('14. POST document-rules', 'sem classId');

  // 15. PUT document-rules/:id
  if (state.ruleId) {
    const { status, data } = await api(cookie, 'PUT', `/api/document-rules/${state.ruleId}`, {
      namingTemplate: 'Relatorio_{parte_receptora}',
      minimumConfidence: 0.75,
      fields: [
        {
          key: 'parte_receptora',
          label: 'Parte receptora',
          type: 'string',
          required: true,
          aliases: ['receptor'],
        },
      ],
    });
    const rule = unwrapEntity(data, ['rule']);
    if (status === 200 && rule?.minimumConfidence === 0.75) {
      pass('15. PUT /api/document-rules/:id', 'minimumConfidence=0.75');
    } else fail('15. PUT document-rules', `status=${status}`);
  } else fail('15. PUT document-rules', 'sem ruleId');

  // 16. PATCH toggle-active rule
  if (state.ruleId) {
    const off = await api(cookie, 'PATCH', `/api/document-rules/${state.ruleId}/toggle-active`);
    const on = await api(cookie, 'PATCH', `/api/document-rules/${state.ruleId}/toggle-active`);
    const rule = unwrapEntity(on.data, ['rule']);
    if (off.status === 200 && on.status === 200) {
      pass('16. PATCH /api/document-rules/:id/toggle-active', `active=${rule?.active}`);
    } else fail('16. PATCH rule toggle', `off=${off.status} on=${on.status}`);
  } else fail('16. PATCH rule toggle', 'sem ruleId');

  // 17. GET document-rules/active
  {
    const { status, data } = await api(cookie, 'GET', '/api/document-rules/active');
    const classes = unwrapList(data, ['classes', 'documentClasses']);
    const rules = unwrapList(data, ['rules', 'documentRules']);
    const hasItems = classes.length > 0 || rules.length > 0;
    if (status === 200 && hasItems) {
      pass('17. GET /api/document-rules/active', `classes=${classes.length} rules=${rules.length}`);
    } else fail('17. GET /api/document-rules/active', `status=${status}`);
  }

  // 18. MongoDB direct check
  if (MONGODB_URI) {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const companyId = getCompanyIdFromUser(user);
    const companyFilter = { companyId };

    const group = state.groupId
      ? await db.collection('access_groups').findOne({ _id: state.groupId, ...companyFilter })
      : null;
    const member = await db.collection('company_members').findOne({ _id: state.memberId, ...companyFilter });
    const docClass = state.classId
      ? await db.collection('document_classes').findOne({ _id: state.classId, ...companyFilter })
      : null;
    const rule = state.ruleId
      ? await db.collection('document_rules').findOne({ _id: state.ruleId, ...companyFilter })
      : null;

    const ok =
      group?.companyId === companyId &&
      member?.companyId === companyId &&
      docClass?.companyId === companyId &&
      rule?.companyId === companyId;

    if (ok) {
      pass('18. MongoDB persistência', `db=${DB_NAME} companyId=${companyId}`);
    } else {
      fail('18. MongoDB persistência', JSON.stringify({ group: !!group, member: !!member, class: !!docClass, rule: !!rule }));
    }
    await client.close();
  } else {
    fail('18. MongoDB persistência', 'MONGODB_URI ausente');
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Resumo ---');
  console.log(`${results.length - failed.length}/${results.length} testes passaram`);
  if (failed.length) {
    console.error('Falhas:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
