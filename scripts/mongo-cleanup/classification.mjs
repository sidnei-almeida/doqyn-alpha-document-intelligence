/**
 * Regras compartilhadas de classificação MongoDB — auditoria e limpeza.
 * Alinhado a server/db/constants.ts (REGISTRY / SHARED_APP / COLLECTIONS).
 */

export const SYSTEM_DATABASES = new Set(['admin', 'local', 'config']);

/** Bases tenant-scoped flat (legado sem prefixo). */
export const FLAT_LEGACY_COLLECTIONS = new Set([
  'documents',
  'document_versions',
  'document_chunks',
  'document_classes',
  'document_categories',
  'document_groups',
  'document_group_members',
  'document_rules',
  'document_extraction_rules',
  'processing_jobs',
  'audit_logs',
  'access_groups',
]);

/** Registry ativo (fonte operacional). */
export const REGISTRY_ACTIVE = new Set(['tenants', 'tenant_members']);

/** Registry legado dual-write — revisar antes de dropar. */
export const REGISTRY_LEGACY_REVIEW = new Set(['company_members', 'companies']);

/**
 * Collections globais do app (SHARED_APP_COLLECTIONS) — não prefixadas.
 * @see server/db/constants.ts
 */
export const SHARED_APP_COLLECTIONS = new Set([
  'user_document_favorites',
  'document_share_grants',
  'external_document_share_grants',
  'document_signature_requests',
  'document_signatures',
  'document_upload_approvals',
  'analysis_jobs',
]);

/** Pool individual compartilhado (`*_compartilhado`). */
const SHARED_POOL_BASES = [
  'documents',
  'document_versions',
  'document_chunks',
  'document_classes',
  'document_categories',
  'document_groups',
  'document_group_members',
  'document_rules',
  'document_extraction_rules',
  'processing_jobs',
  'audit_logs',
];

export const SHARED_POOL_COLLECTIONS = new Set(
  SHARED_POOL_BASES.map((b) => `${b}_compartilhado`).concat(
    SHARED_POOL_BASES.map((b) => `${b}_individual_pool`), // legado normalizado
  ),
);

/** Prefixo business: {base}_{tenantId} (ex. documents_company_dev). */
const TENANT_SCOPED_BASES = [
  'documents',
  'document_versions',
  'document_chunks',
  'document_classes',
  'document_categories',
  'document_groups',
  'document_group_members',
  'document_rules',
  'document_extraction_rules',
  'processing_jobs',
  'audit_logs',
  'access_groups',
];

const ACTIVE_PREFIX_PATTERNS = TENANT_SCOPED_BASES.flatMap((base) => [
  new RegExp(`^${base}_company_`),
  new RegExp(`^${base}_tenant_`),
]);

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

export function isSharedPoolCollection(name) {
  return SHARED_POOL_COLLECTIONS.has(name) || /_compartilhado$/.test(name);
}

export function isNeverDropCollection(name) {
  if (REGISTRY_ACTIVE.has(name)) return true;
  if (SHARED_APP_COLLECTIONS.has(name)) return true;
  if (isSharedPoolCollection(name)) return true;
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
    if (SHARED_APP_COLLECTIONS.has(collectionName) || isSharedPoolCollection(collectionName)) {
      return 'unknown_review_required';
    }
    return 'legacy_candidate';
  }

  if (REGISTRY_ACTIVE.has(collectionName)) return 'active_keep';
  if (SHARED_APP_COLLECTIONS.has(collectionName)) return 'active_keep';
  if (isSharedPoolCollection(collectionName)) return 'active_keep';
  if (isActiveBusinessCollection(collectionName)) return 'active_keep';
  // Qualquer tenant-scoped conhecida: base_*
  if (TENANT_SCOPED_BASES.some((b) => collectionName.startsWith(`${b}_`))) {
    return 'active_keep';
  }

  if (FLAT_LEGACY_COLLECTIONS.has(collectionName)) return 'legacy_candidate';
  if (ACCESS_GROUPS_LEGACY_PATTERN.test(collectionName) && !collectionName.includes('_')) {
    return 'legacy_candidate';
  }

  if (REGISTRY_LEGACY_REVIEW.has(collectionName)) return 'unknown_review_required';

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
