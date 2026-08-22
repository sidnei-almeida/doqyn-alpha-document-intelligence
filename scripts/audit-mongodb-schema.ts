import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionInfo, Db, Document, IndexDescriptionInfo } from 'mongodb';
import { COLLECTIONS, DEV_TENANT_ID, REGISTRY_COLLECTIONS, SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveSharedCollections } from '../server/tenancy/tenantResolver.js';
import { isForbiddenAuditMetadataKey } from '../server/utils/sanitizeAuditMetadata.js';

type Severity = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';

type Finding = {
  severity: Severity;
  category: string;
  message: string;
  collection?: string;
  count?: number;
};

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_AUDITORIA_MONGODB_SCHEMA.txt');

const KNOWN_REGISTRY = new Set(Object.values(REGISTRY_COLLECTIONS));
const KNOWN_SHARED_APP = new Set(Object.values(SHARED_APP_COLLECTIONS));
const KNOWN_BASE = new Set(Object.values(COLLECTIONS));

const TENANT_MEMBER_STATUSES = new Set(['pending', 'active', 'blocked', 'rejected']);
const PLATFORM_ROLES = new Set(['company_admin', 'individual_admin', 'user']);

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /senha/i,
  /token/i,
  /secret/i,
  /refresh/i,
  /^cpf$/i,
  /^cnpj$/i,
  /^taxId$/i,
  /whatsapp/i,
];

const RECOMMENDED_INDEX_FIELDS = [
  'tenantId',
  'companyId',
  'status',
  'createdAt',
  'updatedAt',
  'emailNormalized',
  'authUserId',
  'keycloakUserId',
  'memberId',
  'classId',
  'ruleId',
  'documentId',
  'versionId',
  'accessGroupIds',
];

const findings: Finding[] = [];
const lines: string[] = [];

function addFinding(finding: Finding) {
  findings.push(finding);
}

function line(text = '') {
  lines.push(text);
}

function section(title: string) {
  line();
  line('='.repeat(80));
  line(title);
  line('='.repeat(80));
}

function getTenantId(doc: Document): string | undefined {
  const tenantId = doc.tenantId ?? doc.companyId;
  return typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : undefined;
}

function isLikelyRawTaxId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14;
}

function isLikelyFullWhatsapp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 && !value.includes('*');
}

function indexKeys(index: IndexDescriptionInfo): string[] {
  return Object.keys(index.key ?? {});
}

function hasIndexField(indexes: IndexDescriptionInfo[], field: string): boolean {
  return indexes.some((idx) => indexKeys(idx).includes(field));
}

function suggestMissingIndexes(collectionName: string, indexes: IndexDescriptionInfo[]): string[] {
  const suggestions: string[] = [];
  const lower = collectionName.toLowerCase();

  for (const field of RECOMMENDED_INDEX_FIELDS) {
    if (hasIndexField(indexes, field)) continue;

    const relevant =
      (field === 'tenantId' || field === 'companyId') ||
      (field === 'status' && !collectionName.startsWith('companies')) ||
      (field === 'createdAt' || field === 'updatedAt') ||
      (field === 'emailNormalized' && collectionName.includes('member')) ||
      (field === 'authUserId' && collectionName.includes('member')) ||
      (field === 'keycloakUserId' && collectionName.includes('member')) ||
      (field === 'memberId' && collectionName.includes('member')) ||
      (field === 'classId' && (lower.includes('document') || lower.includes('rule'))) ||
      (field === 'ruleId' && lower.includes('rule')) ||
      (field === 'documentId' && (lower.includes('version') || lower.includes('processing') || lower.includes('audit'))) ||
      (field === 'versionId' && (lower.includes('processing') || lower.includes('audit'))) ||
      (field === 'accessGroupIds' && (lower.includes('member') || lower.includes('document')));

    if (relevant) {
      suggestions.push(field);
    }
  }

  return suggestions;
}

function categorizeCollection(
  name: string,
): 'registry' | 'shared_app' | 'legacy_flat' | 'tenant_prefixed' | 'other' {
  if (KNOWN_REGISTRY.has(name as (typeof REGISTRY_COLLECTIONS)[keyof typeof REGISTRY_COLLECTIONS])) {
    return 'registry';
  }
  if (KNOWN_SHARED_APP.has(name as (typeof SHARED_APP_COLLECTIONS)[keyof typeof SHARED_APP_COLLECTIONS])) {
    return 'shared_app';
  }

  for (const base of KNOWN_BASE) {
    if (name === base) return 'legacy_flat';
    if (name.startsWith(`${base}_`)) return 'tenant_prefixed';
  }

  return 'other';
}

function extractPrefix(collectionName: string): string | null {
  for (const base of KNOWN_BASE) {
    const prefix = `${base}_`;
    if (collectionName.startsWith(prefix)) {
      return collectionName.slice(prefix.length);
    }
  }
  return null;
}

async function scanSensitiveFields(db: Db, collectionName: string) {
  const sample = await db.collection(collectionName).find({}).limit(200).toArray();
  const fieldHits = new Map<string, number>();

  function walk(value: unknown, path: string) {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    if (typeof value === 'object' && value instanceof Date) return;

    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : key;
        const isSensitiveKey = SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key));

        if (isSensitiveKey && nested !== undefined && nested !== null && nested !== '') {
          const riskyValue =
            (key.toLowerCase().includes('taxid') && isLikelyRawTaxId(nested)) ||
            (key.toLowerCase().includes('whatsapp') && isLikelyFullWhatsapp(nested)) ||
            (key.toLowerCase().includes('password') || key.toLowerCase().includes('senha')) ||
            (key.toLowerCase().includes('token') && typeof nested === 'string' && nested.length > 20) ||
            key.toLowerCase().includes('secret');

          if (riskyValue) {
            fieldHits.set(childPath, (fieldHits.get(childPath) ?? 0) + 1);
          }
        }

        walk(nested, childPath);
      }
    }
  }

  for (const doc of sample) {
    walk(doc, '');
  }

  for (const [field, count] of fieldHits.entries()) {
    const severity: Severity =
      field.toLowerCase().includes('password') ||
      field.toLowerCase().includes('secret') ||
      field.toLowerCase().includes('token') ||
      field.toLowerCase().includes('taxid') ||
      field.toLowerCase().includes('cpf') ||
      field.toLowerCase().includes('cnpj')
        ? 'CRITICO'
        : 'ALTO';

    addFinding({
      severity,
      category: 'Segurança',
      collection: collectionName,
      count,
      message: `Campo potencialmente sensível detectado (${field}) em amostra — valor não exibido.`,
    });
  }
}

async function auditTenants(db: Db) {
  const tenants = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).find({}).toArray();
  const tenantIds = new Set(tenants.map((t) => t.tenantId));

  for (const tenant of tenants) {
    const prefix = tenant.isolation?.collectionPrefix ?? '';
    const digitsOnly = prefix.replace(/\D/g, '');

    if (tenant.tenantType === 'business' && tenant.isolation?.strategy !== 'collection_prefix') {
      addFinding({
        severity: 'ALTO',
        category: 'Tenant isolation',
        message: `Tenant business ${tenant.tenantId} sem strategy collection_prefix.`,
      });
    }

    if (tenant.tenantType === 'individual' && tenant.isolation?.strategy !== 'shared_individual_pool') {
      addFinding({
        severity: 'ALTO',
        category: 'Tenant isolation',
        message: `Tenant individual ${tenant.tenantId} sem strategy shared_individual_pool.`,
      });
    }

    if (tenant.tenantType === 'business' && !prefix) {
      addFinding({
        severity: 'CRITICO',
        category: 'Tenant isolation',
        message: `Tenant business ${tenant.tenantId} sem collectionPrefix.`,
      });
    }

    if ((digitsOnly.length === 11 || digitsOnly.length === 14) && !prefix.includes('pool')) {
      addFinding({
        severity: 'CRITICO',
        category: 'Tenant isolation',
        message: `collectionPrefix de ${tenant.tenantId} parece conter documento (${prefix}) — risco de vazamento.`,
      });
    }
  }

  return { tenants, tenantIds };
}

async function auditTenantMembers(
  db: Db,
  tenantIds: Set<string>,
  groupIdsByTenant: Map<string, Set<string>>,
) {
  const col = REGISTRY_COLLECTIONS.tenantMembers;
  const members = await db.collection(col).find({}).toArray();

  const authUserDup = new Map<string, number>();
  const emailDup = new Map<string, number>();

  for (const member of members) {
    const tenantId = getTenantId(member);
    const status = member.status as string | undefined;
    const roles = (member.tenantRoles ?? member.platformRoles ?? []) as string[];
    const groupIds = (member.accessGroupIds ?? member.groupIds ?? []) as string[];

    if (!tenantId) {
      addFinding({ severity: 'CRITICO', category: 'tenant_members', collection: col, count: 1, message: 'Membro sem tenantId.' });
    } else if (!tenantIds.has(tenantId)) {
      addFinding({ severity: 'CRITICO', category: 'tenant_members', collection: col, count: 1, message: `Membro referencia tenant inexistente (${tenantId}).` });
    }

    if (status && !TENANT_MEMBER_STATUSES.has(status)) {
      addFinding({ severity: 'ALTO', category: 'tenant_members', collection: col, count: 1, message: `Status inválido (${status}) em ${member._id}.` });
    }

    for (const role of roles) {
      if (!PLATFORM_ROLES.has(role)) {
        addFinding({ severity: 'ALTO', category: 'tenant_members', collection: col, count: 1, message: `Role inválida (${role}) em ${member._id}.` });
      }
    }

    if (status === 'active' && roles.length === 0) {
      addFinding({ severity: 'ALTO', category: 'tenant_members', collection: col, count: 1, message: `Membro active sem tenantRoles (${member._id}).` });
    }

    if (status === 'pending' && member.approvedAt) {
      addFinding({ severity: 'MEDIO', category: 'tenant_members', collection: col, count: 1, message: `Pending com approvedAt (${member._id}).` });
    }

    if (status === 'rejected' && member.approvedAt) {
      addFinding({ severity: 'MEDIO', category: 'tenant_members', collection: col, count: 1, message: `Rejected com approvedAt (${member._id}).` });
    }

    for (const groupId of groupIds) {
      const validGroups = tenantId ? groupIdsByTenant.get(tenantId) : undefined;
      if (validGroups && !validGroups.has(groupId)) {
        addFinding({ severity: 'ALTO', category: 'tenant_members', collection: col, count: 1, message: `accessGroupId inexistente (${groupId}) em ${member._id}.` });
      }
    }

    const authUserId =
      typeof member.authUserId === 'string'
        ? member.authUserId
        : typeof (member as { keycloakUserId?: string }).keycloakUserId === 'string'
          ? (member as { keycloakUserId?: string }).keycloakUserId
          : undefined;
    if (tenantId && authUserId) {
      const key = `${tenantId}::${authUserId}`;
      authUserDup.set(key, (authUserDup.get(key) ?? 0) + 1);
    }

    if (tenantId && member.emailNormalized) {
      const key = `${tenantId}::${member.emailNormalized}`;
      emailDup.set(key, (emailDup.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of authUserDup.entries()) {
    if (count > 1) {
      addFinding({ severity: 'MEDIO', category: 'tenant_members', collection: col, count, message: `authUserId duplicado no tenant (${key.split('::')[0]}).` });
    }
  }

  for (const [key, count] of emailDup.entries()) {
    if (count > 1) {
      addFinding({ severity: 'MEDIO', category: 'tenant_members', collection: col, count, message: `emailNormalized duplicado no tenant (${key.split('::')[0]}).` });
    }
  }

  return members.length;
}

async function loadAccessGroups(db: Db, collectionNames: string[]) {
  const groupIdsByTenant = new Map<string, Set<string>>();
  const allGroups: Array<{ collection: string; tenantId: string; _id: string; name?: string; active?: boolean }> = [];

  for (const collectionName of collectionNames) {
    const groups = await db.collection(collectionName).find({}).toArray();
    for (const group of groups) {
      const tenantId = getTenantId(group);
      if (!tenantId) {
        addFinding({ severity: 'CRITICO', category: 'access_groups', collection: collectionName, count: 1, message: 'Grupo sem tenantId.' });
        continue;
      }

      if (!group.name) {
        addFinding({ severity: 'MEDIO', category: 'access_groups', collection: collectionName, count: 1, message: `Grupo sem nome (${group._id}).` });
      }

      if (group.active === undefined) {
        addFinding({ severity: 'BAIXO', category: 'access_groups', collection: collectionName, count: 1, message: `Grupo sem campo active (${group._id}).` });
      }

      if (!groupIdsByTenant.has(tenantId)) groupIdsByTenant.set(tenantId, new Set());
      groupIdsByTenant.get(tenantId)!.add(String(group._id));
      allGroups.push({ collection: collectionName, tenantId, _id: String(group._id), name: group.name, active: group.active });
    }
  }

  return { groupIdsByTenant, allGroups };
}

async function auditTenantScopedCollection(
  db: Db,
  collectionName: string,
  tenantIds: Set<string>,
  classIdsByTenant: Map<string, Set<string>>,
  documentIdsByTenant: Map<string, Set<string>>,
) {
  const docs = await db.collection(collectionName).find({}).toArray();
  let missingTenant = 0;
  let invalidTenant = 0;

  for (const doc of docs) {
    const tenantId = getTenantId(doc);
    if (!tenantId) {
      missingTenant += 1;
      continue;
    }
    if (!tenantIds.has(tenantId)) {
      invalidTenant += 1;
    }

    if (collectionName.includes('document_classes') || collectionName.endsWith('document_classes')) {
      if (!classIdsByTenant.has(tenantId)) classIdsByTenant.set(tenantId, new Set());
      classIdsByTenant.get(tenantId)!.add(String(doc._id));
      if (!doc.slug) {
        addFinding({ severity: 'MEDIO', category: 'document_classes', collection: collectionName, count: 1, message: `Classe sem slug (${doc._id}).` });
      }
    }

    if (collectionName.includes('document_rules') || collectionName.endsWith('document_rules')) {
      const classId = doc.classId as string | undefined;
      if (classId && classIdsByTenant.get(tenantId) && !classIdsByTenant.get(tenantId)!.has(classId)) {
        addFinding({ severity: 'ALTO', category: 'document_rules', collection: collectionName, count: 1, message: `Rule aponta classId inexistente (${classId}).` });
      }
      if (doc.active && (!doc.fields || (Array.isArray(doc.fields) && doc.fields.length === 0))) {
        addFinding({ severity: 'MEDIO', category: 'document_rules', collection: collectionName, count: 1, message: `Rule active sem fields (${doc._id}).` });
      }
    }

    if (collectionName.includes('documents') && !collectionName.includes('document_versions')) {
      const classId = doc.classId as string | undefined;
      if (!doc.currentVersionId) {
        addFinding({ severity: 'ALTO', category: 'documents', collection: collectionName, count: 1, message: `Document sem currentVersionId (${doc._id}).` });
      }
      if (!doc.status) {
        addFinding({ severity: 'MEDIO', category: 'documents', collection: collectionName, count: 1, message: `Document sem status (${doc._id}).` });
      }
      if (classId && classIdsByTenant.get(tenantId) && !classIdsByTenant.get(tenantId)!.has(classId)) {
        addFinding({ severity: 'ALTO', category: 'documents', collection: collectionName, count: 1, message: `Document com classId inexistente (${classId}).` });
      }
      if (!documentIdsByTenant.has(tenantId)) documentIdsByTenant.set(tenantId, new Set());
      documentIdsByTenant.get(tenantId)!.add(String(doc._id));
    }
  }

  if (missingTenant > 0) {
    addFinding({ severity: 'CRITICO', category: 'Tenant isolation', collection: collectionName, count: missingTenant, message: 'Documentos sem tenantId/companyId.' });
  }
  if (invalidTenant > 0) {
    addFinding({ severity: 'CRITICO', category: 'Tenant isolation', collection: collectionName, count: invalidTenant, message: 'Documentos com tenantId inexistente em tenants.' });
  }

  return docs.length;
}

async function auditVersions(
  db: Db,
  collectionName: string,
  tenantIds: Set<string>,
  documentIdsByTenant: Map<string, Set<string>>,
) {
  const versions = await db.collection(collectionName).find({}).toArray();
  const versionKeyCounts = new Map<string, number>();

  for (const version of versions) {
    const tenantId = getTenantId(version);
    const documentId = version.documentId as string | undefined;
    const versionNumber = version.versionNumber as number | undefined;
    const storageKey = version.storage?.primary?.objectKey ?? version.storage?.backup?.objectKey;

    if (!tenantId) {
      addFinding({ severity: 'CRITICO', category: 'document_versions', collection: collectionName, count: 1, message: `Version sem tenantId (${version._id}).` });
    } else if (!tenantIds.has(tenantId)) {
      addFinding({ severity: 'CRITICO', category: 'document_versions', collection: collectionName, count: 1, message: `Version com tenantId inválido (${version._id}).` });
    }

    if (documentId) {
      const docsForTenant = tenantId ? documentIdsByTenant.get(tenantId) : undefined;
      if (docsForTenant && !docsForTenant.has(documentId)) {
        addFinding({ severity: 'CRITICO', category: 'document_versions', collection: collectionName, count: 1, message: `Version com documentId inexistente no tenant (${documentId}).` });
      }
    } else {
      addFinding({ severity: 'ALTO', category: 'document_versions', collection: collectionName, count: 1, message: `Version sem documentId (${version._id}).` });
    }

    if (!storageKey) {
      addFinding({ severity: 'MEDIO', category: 'document_versions', collection: collectionName, count: 1, message: `Version sem objectKey/storage (${version._id}).` });
    }

    if (documentId && versionNumber !== undefined) {
      const key = `${documentId}::${versionNumber}`;
      versionKeyCounts.set(key, (versionKeyCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [, count] of versionKeyCounts.entries()) {
    if (count > 1) {
      addFinding({ severity: 'MEDIO', category: 'document_versions', collection: collectionName, count, message: 'Duplicidade documentId + versionNumber.' });
    }
  }

  return versions.length;
}

async function auditProcessingJobs(
  db: Db,
  collectionName: string,
  tenantIds: Set<string>,
  documentIdsByTenant: Map<string, Set<string>>,
) {
  const allowed = new Set(['pending', 'in_progress', 'completed', 'failed', 'requires_review', 'processing']);
  const jobs = await db.collection(collectionName).find({}).toArray();
  const staleThresholdMs = 1000 * 60 * 60 * 6;
  const now = Date.now();

  for (const job of jobs) {
    const tenantId = getTenantId(job);
    const documentId = job.documentId as string | undefined;
    const status = job.status as string | undefined;

    if (!tenantId) {
      addFinding({ severity: 'CRITICO', category: 'processing_jobs', collection: collectionName, count: 1, message: `Job sem tenantId (${job._id}).` });
    } else if (!tenantIds.has(tenantId)) {
      addFinding({ severity: 'CRITICO', category: 'processing_jobs', collection: collectionName, count: 1, message: `Job com tenantId inválido (${job._id}).` });
    }

    if (documentId && tenantId) {
      const docs = documentIdsByTenant.get(tenantId);
      if (docs && !docs.has(documentId)) {
        addFinding({ severity: 'ALTO', category: 'processing_jobs', collection: collectionName, count: 1, message: `Job com documentId inexistente (${documentId}).` });
      }
    }

    if (status && !allowed.has(status)) {
      addFinding({ severity: 'MEDIO', category: 'processing_jobs', collection: collectionName, count: 1, message: `Job com status não permitido (${status}).` });
    }

    if ((status === 'processing' || status === 'in_progress' || status === 'pending') && job.updatedAt instanceof Date) {
      if (now - job.updatedAt.getTime() > staleThresholdMs) {
        addFinding({ severity: 'MEDIO', category: 'processing_jobs', collection: collectionName, count: 1, message: `Job possivelmente travado (${job._id}).` });
      }
    }

    if (!job.createdAt || !job.updatedAt) {
      addFinding({ severity: 'BAIXO', category: 'processing_jobs', collection: collectionName, count: 1, message: `Job sem createdAt/updatedAt (${job._id}).` });
    }
  }

  return jobs.length;
}

async function auditAuditLogs(db: Db, collectionName: string, tenantIds: Set<string>) {
  const logs = await db.collection(collectionName).find({}).limit(500).toArray();
  let missingTenant = 0;

  for (const log of logs) {
    const tenantId = getTenantId(log);
    if (!tenantId) {
      missingTenant += 1;
    } else if (!tenantIds.has(tenantId)) {
      addFinding({ severity: 'ALTO', category: 'audit_logs', collection: collectionName, count: 1, message: `Audit log com tenantId inválido (${log._id}).` });
    }

    const actorUserId = log.actor?.userId;
    if (!actorUserId && log.action !== 'USER_ACCESS_REQUESTED') {
      addFinding({ severity: 'MEDIO', category: 'audit_logs', collection: collectionName, count: 1, message: `Audit log sem actor.userId (${log._id}).` });
    }

    if (log.metadata && typeof log.metadata === 'object') {
      for (const [key, value] of Object.entries(log.metadata as Record<string, unknown>)) {
        if (isForbiddenAuditMetadataKey(key)) {
          addFinding({ severity: 'CRITICO', category: 'audit_logs', collection: collectionName, count: 1, message: `Metadata sensível em audit log (campo ${key}, valor omitido).` });
        } else if (isLikelyRawTaxId(value) || isLikelyFullWhatsapp(value)) {
          addFinding({ severity: 'CRITICO', category: 'audit_logs', collection: collectionName, count: 1, message: `Metadata sensível em audit log (campo ${key}, valor omitido).` });
        }
      }
    }
  }

  if (missingTenant > 0) {
    addFinding({ severity: 'ALTO', category: 'audit_logs', collection: collectionName, count: missingTenant, message: 'Audit logs sem tenantId.' });
  }

  return logs.length;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    throw new Error('MONGODB_URI não configurada. Configure o .env antes de auditar.');
  }

  const db = await getDb();
  const databaseName = getMongoDatabaseName();
  const collectionInfos = await db.listCollections().toArray();
  const collectionNames = collectionInfos.map((c: CollectionInfo) => c.name).sort();

  const counts = new Map<string, number>();
  const indexesByCollection = new Map<string, IndexDescriptionInfo[]>();
  const indexSuggestions = new Map<string, string[]>();

  for (const name of collectionNames) {
    counts.set(name, await db.collection(name).countDocuments());
    const indexes = await db.collection(name).indexes();
    indexesByCollection.set(name, indexes);
    indexSuggestions.set(name, suggestMissingIndexes(name, indexes));
    await scanSensitiveFields(db, name);
  }

  const { tenants, tenantIds } = await auditTenants(db);

  const accessGroupCollections = collectionNames.filter(
    (n) => n === COLLECTIONS.accessGroups || n.startsWith(`${COLLECTIONS.accessGroups}_`),
  );
  const { groupIdsByTenant, allGroups } = await loadAccessGroups(db, accessGroupCollections);

  await auditTenantMembers(db, tenantIds, groupIdsByTenant);

  const classIdsByTenant = new Map<string, Set<string>>();
  const documentIdsByTenant = new Map<string, Set<string>>();

  for (const tenant of tenants) {
    try {
      const names = resolveSharedCollections();
      const scopedCollections = Object.values(names).filter(Boolean) as string[];
      for (const collectionName of scopedCollections) {
        if (!collectionNames.includes(collectionName)) continue;

        if (collectionName.includes('document_versions')) {
          await auditVersions(db, collectionName, tenantIds, documentIdsByTenant);
        } else if (collectionName.includes('processing_jobs')) {
          await auditProcessingJobs(db, collectionName, tenantIds, documentIdsByTenant);
        } else if (collectionName.includes('audit_logs')) {
          await auditAuditLogs(db, collectionName, tenantIds);
        } else {
          await auditTenantScopedCollection(db, collectionName, tenantIds, classIdsByTenant, documentIdsByTenant);
        }
      }
    } catch (error) {
      addFinding({
        severity: 'ALTO',
        category: 'Tenant isolation',
        message: `Falha ao resolver collections do tenant ${tenant.tenantId}: ${error instanceof Error ? error.message : 'erro'}`,
      });
    }
  }

  for (const collectionName of collectionNames.filter((n) => categorizeCollection(n) === 'legacy_flat')) {
    await auditTenantScopedCollection(db, collectionName, tenantIds, classIdsByTenant, documentIdsByTenant);
  }

  const referencedGroups = new Set<string>();
  const members = await db.collection(REGISTRY_COLLECTIONS.tenantMembers).find({}).project({ accessGroupIds: 1, groupIds: 1, tenantId: 1, companyId: 1 }).toArray();
  for (const member of members) {
    for (const gid of [...(member.accessGroupIds ?? []), ...(member.groupIds ?? [])]) {
      referencedGroups.add(String(gid));
    }
  }

  for (const group of allGroups) {
    if (!referencedGroups.has(group._id)) {
      addFinding({ severity: 'BAIXO', category: 'access_groups', collection: group.collection, count: 1, message: `Grupo órfão não referenciado (${group._id}).` });
    }
  }

  const emptyCollections = [...counts.entries()].filter(([, count]) => count === 0).map(([name]) => name);
  const legacyCollections = collectionNames.filter((n) => categorizeCollection(n) === 'legacy_flat');
  const prefixedCollections = collectionNames.filter((n) => categorizeCollection(n) === 'tenant_prefixed');
  const sharedAppCollections = collectionNames.filter((n) => categorizeCollection(n) === 'shared_app');

  const critical = findings.filter((f) => f.severity === 'CRITICO');
  const high = findings.filter((f) => f.severity === 'ALTO');
  const medium = findings.filter((f) => f.severity === 'MEDIO');
  const low = findings.filter((f) => f.severity === 'BAIXO');

  line('DOQYN — Relatório de auditoria MongoDB (schema, índices, tenant isolation)');
  line(`Data: ${new Date().toISOString()}`);
  line(`Database: ${databaseName}`);
  line('Observação: relatório sanitizado — sem URI, secrets, PII cru ou conteúdo de documentos.');

  section('RESUMO EXECUTIVO');
  line(`Coleções encontradas: ${collectionNames.length}`);
  line(`Tenants: ${tenants.length}`);
  line(`Coleções vazias: ${emptyCollections.length}`);
  line(`Coleções SHARED_APP: ${sharedAppCollections.length}`);
  line(`Coleções legadas (flat): ${legacyCollections.length}`);
  line(`Coleções com prefixo de tenant: ${prefixedCollections.length}`);
  line(`Achados CRÍTICOS: ${critical.length}`);
  line(`Achados ALTOS: ${high.length}`);
  line(`Achados MÉDIOS: ${medium.length}`);
  line(`Achados BAIXOS: ${low.length}`);

  section('COLEÇÕES E CONTAGENS');
  for (const name of collectionNames) {
    const category = categorizeCollection(name);
    const prefix = extractPrefix(name);
    line(`${name}: ${counts.get(name)} docs [${category}${prefix ? `, prefix=${prefix}` : ''}]`);
  }

  section('ÍNDICES ATUAIS');
  for (const name of collectionNames) {
    line(`-- ${name}`);
    for (const idx of indexesByCollection.get(name) ?? []) {
      line(`   ${idx.name}: ${JSON.stringify(idx.key)}`);
    }
  }

  section('ÍNDICES RECOMENDADOS (ausentes)');
  let anySuggestion = false;
  for (const name of collectionNames) {
    const suggestions = indexSuggestions.get(name) ?? [];
    if (suggestions.length === 0) continue;
    anySuggestion = true;
    line(`${name}: ${suggestions.join(', ')}`);
  }
  if (!anySuggestion) line('Nenhuma sugestão adicional relevante.');

  section('PROBLEMAS CRÍTICOS');
  if (critical.length === 0) line('Nenhum.');
  for (const f of critical) line(`[${f.category}] ${f.collection ?? '-'} — ${f.message}${f.count ? ` (≈${f.count})` : ''}`);

  section('PROBLEMAS ALTOS');
  if (high.length === 0) line('Nenhum.');
  for (const f of high) line(`[${f.category}] ${f.collection ?? '-'} — ${f.message}${f.count ? ` (≈${f.count})` : ''}`);

  section('PROBLEMAS MÉDIOS');
  if (medium.length === 0) line('Nenhum.');
  for (const f of medium) line(`[${f.category}] ${f.collection ?? '-'} — ${f.message}${f.count ? ` (≈${f.count})` : ''}`);

  section('PROBLEMAS BAIXOS');
  if (low.length === 0) line('Nenhum.');
  for (const f of low) line(`[${f.category}] ${f.collection ?? '-'} — ${f.message}${f.count ? ` (≈${f.count})` : ''}`);

  section('VALIDAÇÃO DE ISOLAMENTO POR TENANT');
  line(`DEV_TENANT_ID esperado no projeto: ${DEV_TENANT_ID}`);
  for (const tenant of tenants) {
    line(`- ${tenant.tenantId}: type=${tenant.tenantType}, strategy=${tenant.isolation?.strategy}, prefix=${tenant.isolation?.collectionPrefix}, status=${tenant.status}`);
  }
  if (legacyCollections.length > 0) {
    line('Coleções legadas flat ainda presentes (migração incompleta):');
    for (const name of legacyCollections) line(`  - ${name} (${counts.get(name)} docs)`);
  }

  section('VALIDAÇÃO DE RELAÇÕES');
  line(`Grupos carregados: ${allGroups.length}`);
  line(`Tenants com grupos: ${groupIdsByTenant.size}`);
  line(`Tenants com classes: ${classIdsByTenant.size}`);
  line(`Tenants com documents: ${documentIdsByTenant.size}`);

  section('MELHORIAS RECOMENDADAS');
  line('1. Concluir migração de coleções flat para prefixadas por tenant business.');
  line('2. Garantir índices compostos tenantId+status e tenantId+createdAt nas coleções quentes.');
  line('3. Remover ou arquivar company_members após tenant_members ser fonte única.');
  line('4. Evitar taxId/CPF/CNPJ em collectionPrefix — usar tenantId interno.');
  line('5. Revisar grupos órfãos e rules/classes inactive ainda referenciadas.');
  line('6. Implementar worker futuro de notification_deliveries sem armazenar PII em audit metadata.');

  section('PRÓXIMOS PASSOS');
  line('1. Corrigir achados CRÍTICOS de tenant isolation antes de produção.');
  line('2. Aplicar índices recomendados em staging e medir explain().');
  line('3. Executar npm run audit:mongodb-schema periodicamente após migrations.');
  line('4. Validar dual-write tenant_members/company_members até desligar legado.');

  section('FIM DO RELATÓRIO');

  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Relatório gerado em: ${REPORT_PATH}`);
  console.log(`Database: ${databaseName} | Coleções: ${collectionNames.length} | Críticos: ${critical.length}`);
}

main()
  .then(async () => {
    await closeMongoConnection();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Falha na auditoria MongoDB:', error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
