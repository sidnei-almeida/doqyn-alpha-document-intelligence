import 'dotenv/config';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveTenantCollectionNames } from '../server/tenancy/tenantResolver.js';
import { withTenantFields } from '../server/tenancy/tenantQuery.js';
import { buildDevStorageObjectKey } from './lib/devStorage.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_SEED_ISOLATION_TEST.txt');

const TEST_TENANT_ID = 'company_test_2';
const TEST_PREFIX = 'company_test_2';

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const db = await getDb();
  const now = new Date();
  const fakeTaxHash = createHash('sha256').update(`isolation-test-${TEST_TENANT_ID}`).digest('hex');

  const tenant: MongoTenant = {
    _id: `tenant_${TEST_TENANT_ID}`,
    tenantId: TEST_TENANT_ID,
    tenantType: 'business',
    country: 'BR',
    taxIdType: 'cnpj',
    taxIdMasked: '**.***.0001/****-99',
    taxIdHash: fakeTaxHash,
    displayName: 'Empresa Teste 2',
    legalName: 'Empresa Teste 2 LTDA',
    slug: 'empresa-teste-2',
    status: 'active',
    isolation: { strategy: 'collection_prefix', collectionPrefix: TEST_PREFIX },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(REGISTRY_COLLECTIONS.tenants).updateOne(
    { tenantId: TEST_TENANT_ID },
    { $set: tenant },
    { upsert: true },
  );

  const names = resolveTenantCollectionNames(tenant);
  const groupId = 'group_financeiro_test2';
  const categoryId = 'class_test2';
  const accessRuleId = 'access_rule_test2';
  const extractionRuleId = 'rule_test2';
  const documentId = 'doc_test2';
  const versionId = 'ver_test2';
  const auditId = 'audit_test2';

  await db.collection(names.documentGroups!).updateOne(
    { _id: groupId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: groupId,
        name: 'Financeiro Teste 2',
        slug: 'financeiro-teste-2',
        color: '#2563eb',
        active: true,
        createdAt: now,
        updatedAt: now,
      }),
    },
    { upsert: true },
  );

  await db.collection(names.documentCategories!).updateOne(
    { _id: categoryId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: categoryId,
        name: 'Classe Teste 2',
        slug: 'classe-teste-2',
        description: 'Classe de isolamento',
        active: true,
        iconKey: 'file',
        color: '#16a34a',
        keywords: ['teste'],
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
      }),
    },
    { upsert: true },
  );

  await db.collection(names.documentRules!).updateOne(
    { _id: accessRuleId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: accessRuleId,
        groupId,
        categoryId,
        active: true,
        permissions: {
          view: true,
          download: true,
          upload: true,
          share: true,
          manage: false,
        },
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
      }),
    },
    { upsert: true },
  );

  await db.collection(names.documentExtractionRules!).updateOne(
    { _id: extractionRuleId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: extractionRuleId,
        categoryId,
        version: 1,
        active: true,
        fields: [
          {
            key: 'documentNumber',
            label: 'Número do documento',
            type: 'string',
            required: false,
            description: 'Identificador interno do documento de teste.',
          },
        ],
        namingTemplate: 'Teste2_{documentNumber}_v{version}',
        minimumConfidence: 0.5,
        onLowConfidence: 'requires_review',
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
      }),
    },
    { upsert: true },
  );

  await db.collection(names.documents).updateOne(
    { _id: documentId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: documentId,
        documentCode: 'TST2-001',
        currentVersionId: versionId,
        classId: categoryId,
        className: 'Classe Teste 2',
        title: 'Documento Teste 2',
        currentFileName: 'teste2.pdf',
        status: 'active',
        processingStatus: 'processed',
        access: {
          viewGroupIds: [groupId],
          downloadGroupIds: [groupId],
          updateGroupIds: [groupId],
          auditGroupIds: [groupId],
          shareGroupIds: [groupId],
        },
        searchMeta: { people: [], dates: [] },
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
      }),
    },
    { upsert: true },
  );

  const devObjectKey = buildDevStorageObjectKey(TEST_TENANT_ID, documentId, 1);

  await db.collection(names.documentVersions).updateOne(
    { _id: versionId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: versionId,
        documentId,
        versionNumber: 1,
        versionLabel: 'v1',
        previousVersionId: null,
        originalFileName: 'teste2.pdf',
        recommendedFileName: 'teste2.pdf',
        finalFileName: 'teste2.pdf',
        file: {
          mimeType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 1024,
          sha256: 'dev-seed-sha256-placeholder',
        },
        classification: {
          classId: categoryId,
          className: 'Classe Teste 2',
          confidence: 1,
          requiresReview: false,
          reason: 'seed',
        },
        rule: { ruleId: extractionRuleId, ruleVersion: 1 },
        metadata: {},
        storage: {
          primary: {
            provider: 'aws_s3',
            status: 'pending',
            objectKey: devObjectKey,
            bucketAlias: 'dev-local',
            storedAt: null,
          },
          backup: {
            provider: 'cloudflare_r2',
            status: 'pending',
            objectKey: devObjectKey,
            bucketAlias: 'dev-backup',
            storedAt: null,
          },
        },
        review: { required: false, reasons: [], reviewedBy: null, reviewedAt: null },
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
      }),
    },
    { upsert: true },
  );

  const jobId = 'job_test2_seed';
  await db.collection(names.processingJobs).updateOne(
    { _id: jobId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: jobId,
        documentId,
        versionId,
        type: 'seed',
        status: 'completed',
        steps: [{ key: 'seed', label: 'Seed', status: 'done', createdAt: now }],
        error: null,
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      }),
    },
    { upsert: true },
  );

  await db.collection(names.auditLogs).updateOne(
    { _id: auditId },
    {
      $set: withTenantFields(TEST_TENANT_ID, {
        _id: auditId,
        documentId,
        versionId,
        actor: { userId: 'seed', name: 'Seed', role: 'system' },
        action: 'document.created',
        description: 'Documento teste 2 criado pelo seed de isolamento',
        createdAt: now,
      }),
    },
    { upsert: true },
  );

  const memberId = `member_test2_${randomUUID().slice(0, 8)}`;
  await db.collection(REGISTRY_COLLECTIONS.tenantMembers).updateOne(
    { tenantId: TEST_TENANT_ID, emailNormalized: 'isolation-test@doqyn.test' },
    {
      $setOnInsert: {
        _id: `tm_${memberId}`,
        memberId,
        tenantId: TEST_TENANT_ID,
        companyId: TEST_TENANT_ID,
        authUserId: 'fake-auth-isolation-test-2',
        email: 'isolation-test@doqyn.test',
        emailNormalized: 'isolation-test@doqyn.test',
        firstName: 'Isolation',
        lastName: 'Test',
        status: 'active',
        tenantRoles: ['company_admin'],
        accessGroupIds: [groupId],
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const report = createReportWriter();
  report.line('DOQYN — Seed segundo tenant (isolamento)');
  report.line(`Data: ${now.toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Tenant: ${TEST_TENANT_ID}`);
  report.line(`Prefix: ${TEST_PREFIX}`);
  report.line('Relatório sanitizado.');

  report.section('COLEÇÕES CRIADAS/ATUALIZADAS');
  for (const [key, name] of Object.entries(names)) {
    if (!name) continue;
    const count = await db.collection(name).countDocuments();
    report.line(`${key}: ${name} (${count} docs)`);
  }

  report.section('DADOS MÍNIMOS');
  report.line(`Grupo: ${groupId}`);
  report.line(`Classe: ${classId}`);
  report.line(`Regra: ${ruleId}`);
  report.line(`Documento: ${documentId}`);
  report.line(`Versão: ${versionId}`);
  report.line(`Audit: ${auditId}`);
  report.line(`Member: ${memberId} (authUserId fake)`);

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Seed concluído: ${TEST_TENANT_ID}`);
  console.log(`Relatório: ${REPORT_PATH}`);

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
