/**
 * Regras compartilhadas de classificação MongoDB — auditoria e limpeza.
 */

export const SYSTEM_DATABASES = new Set(['admin', 'local', 'config']);

export const FLAT_LEGACY_COLLECTIONS = new Set([
  'documents',
  'document_versions',
  'document_classes',
  'document_rules',
  'processing_jobs',
  'audit_logs',
  'access_groups',
]);

export const REGISTRY_ACTIVE = new Set(['tenants']);

/** Ainda referenciadas no código; revisar antes de remover (legado dual-write / JWT local). */
export const REGISTRY_LEGACY_REVIEW = new Set([
  'tenant_members',
  'company_members',
  'companies',
]);

export const SHARED_ACTIVE_COLLECTIONS = new Set([
  'documents_compartilhado',
  'document_versions_compartilhado',
  'document_classes_compartilhado',
  'document_rules_compartilhado',
  'processing_jobs_compartilhado',
  'audit_logs_compartilhado',
]);

const ACTIVE_PREFIX_PATTERNS = [
  /^documents_company_/,
  /^document_versions_company_/,
  /^document_classes_company_/,
  /^document_rules_company_/,
  /^processing_jobs_company_/,
  /^audit_logs_company_/,
  /^documents_individual_/,
  /^document_versions_individual_/,
  /^document_classes_individual_/,
  /^document_rules_individual_/,
  /^processing_jobs_individual_/,
  /^audit_logs_individual_/,
];

const ACCESS_GROUPS_LEGACY_PATTERN = /^access_groups/;

export function getActiveDatabaseName(env = process.env) {
  return env.MONGODB_DATABASE?.trim() || 'doqyn_dev';
}

export function getLegacyDatabaseName(env = process.env) {
  return env.MONGODB_DB_NAME?.trim() || 'doqyn_alpha';
}

export function isActiveBusinessCollection(name) {
  return ACTIVE_PREFIX_PATTERNS.some((re) => re.test(name));
}

export function isNeverDropCollection(name) {
  if (REGISTRY_ACTIVE.has(name)) return true;
  if (SHARED_ACTIVE_COLLECTIONS.has(name)) return true;
  if (isActiveBusinessCollection(name)) return true;
  return false;
}

/**
 * @returns {'active_keep' | 'legacy_candidate' | 'system_do_not_touch' | 'unknown_review_required'}
 */
export function classifyCollection(databaseName, collectionName, activeDatabase) {
  if (SYSTEM_DATABASES.has(databaseName)) {
    return 'system_do_not_touch';
  }

  if (databaseName !== activeDatabase) {
    if (FLAT_LEGACY_COLLECTIONS.has(collectionName) || ACCESS_GROUPS_LEGACY_PATTERN.test(collectionName)) {
      return 'legacy_candidate';
    }
    if (REGISTRY_LEGACY_REVIEW.has(collectionName) || REGISTRY_ACTIVE.has(collectionName)) {
      return 'unknown_review_required';
    }
    return 'legacy_candidate';
  }

  if (REGISTRY_ACTIVE.has(collectionName)) return 'active_keep';
  if (SHARED_ACTIVE_COLLECTIONS.has(collectionName)) return 'active_keep';
  if (isActiveBusinessCollection(collectionName)) return 'active_keep';

  if (FLAT_LEGACY_COLLECTIONS.has(collectionName)) return 'legacy_candidate';
  if (ACCESS_GROUPS_LEGACY_PATTERN.test(collectionName)) return 'legacy_candidate';

  if (REGISTRY_LEGACY_REVIEW.has(collectionName)) return 'unknown_review_required';

  if (collectionName === 'document_chunks') return 'unknown_review_required';

  return 'unknown_review_required';
}

/**
 * @returns {'active_keep' | 'legacy_candidate' | 'system_do_not_touch' | 'unknown_review_required'}
 */
export function classifyDatabase(databaseName, activeDatabase, legacyDatabase) {
  if (SYSTEM_DATABASES.has(databaseName)) return 'system_do_not_touch';
  if (databaseName === activeDatabase) return 'active_keep';
  if (databaseName === legacyDatabase) return 'legacy_candidate';
  return 'unknown_review_required';
}

export function listLegacyDropTargets(collections, activeDatabase) {
  return collections.filter(({ database, name, classification }) => {
    if (database === activeDatabase && classification === 'legacy_candidate') {
      return !isNeverDropCollection(name);
    }
    if (database !== activeDatabase && classification === 'legacy_candidate') {
      return true;
    }
    return false;
  });
}

export function listDropEntireDatabaseCandidates(databases, activeDatabase, legacyDatabase) {
  return databases.filter(
    (db) =>
      db.name === legacyDatabase &&
      db.classification === 'legacy_candidate' &&
      db.name !== activeDatabase,
  );
}
