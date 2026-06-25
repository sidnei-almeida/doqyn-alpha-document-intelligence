import { COLLECTIONS } from '../db/constants.js';
import type { MongoTenant } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { resolveTenantCollectionNames } from './tenantResolver.js';

/** Nomes base flat — proibidos para leitura/escrita tenant-scoped em runtime produtivo. */
export const FLAT_TENANT_SCOPED_COLLECTIONS = new Set<string>(Object.values(COLLECTIONS));

export function isFlatTenantScopedCollection(name: string): boolean {
  return FLAT_TENANT_SCOPED_COLLECTIONS.has(name);
}

export function assertNotFlatTenantCollection(collectionName: string): void {
  if (isFlatTenantScopedCollection(collectionName)) {
    throw new ServiceError(
      `Acesso negado à coleção flat tenant-scoped "${collectionName}". Use getTenantCollections().`,
      'FLAT_COLLECTION_ACCESS_DENIED',
      500,
    );
  }
}

/**
 * Garante que a coleção pertence ao tenant resolvido (prefixada ou pool individual).
 * Bloqueia uso acidental de coleções flat em runtime.
 */
export function assertTenantScopedCollectionAccess(
  tenant: MongoTenant,
  collectionName: string,
): void {
  assertNotFlatTenantCollection(collectionName);

  const expected = resolveTenantCollectionNames(tenant);
  const allowed = new Set(
    Object.values(expected).filter((name): name is string => Boolean(name)),
  );

  if (!allowed.has(collectionName)) {
    throw new ServiceError(
      `Coleção "${collectionName}" não pertence ao tenant "${tenant.tenantId}".`,
      'TENANT_COLLECTION_MISMATCH',
      403,
    );
  }
}

/** Detecta prefixo que parece CPF/CNPJ cru (apenas dígitos, 11 ou 14). */
export function isUnsafeCollectionPrefix(prefix: string): boolean {
  const trimmed = prefix.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === trimmed.length && (digits.length === 11 || digits.length === 14)) {
    return true;
  }
  return false;
}
