import type { TenantStorageContext } from './tenantStorage.js';
import {
  applyClassRuleOwnershipOnInsert,
  applyDocumentOwnershipOnInsert,
  assertCanAccessDocument,
  buildClassRuleOwnershipFilter,
  buildDocumentOwnershipFilter,
} from './documentOwnership.js';

export {
  assertCanAccessDocument,
  buildClassRuleOwnershipFilter,
  buildDocumentOwnershipFilter,
  applyClassRuleOwnershipOnInsert,
};

/** @deprecated Prefer buildDocumentOwnershipFilter com TenantStorageContext */
export function tenantScopeFilter(tenantId: string): Record<string, unknown> {
  return {
    $or: [{ tenantId }, { companyId: tenantId }],
  };
}

export function tenantScopeFilterFromContext(context: TenantStorageContext): Record<string, unknown> {
  return buildDocumentOwnershipFilter(context);
}

export function withTenantFields<T extends Record<string, unknown>>(
  tenantId: string,
  doc: T,
  ownerUserId?: string,
): T & { tenantId: string; companyId: string; ownerUserId?: string } {
  return {
    ...doc,
    tenantId,
    companyId: tenantId,
    ...(ownerUserId ? { ownerUserId } : {}),
  };
}

export function withTenantFieldsFromContext<T extends Record<string, unknown>>(
  context: TenantStorageContext,
  doc: T,
  ownerUserId?: string,
): ReturnType<typeof applyDocumentOwnershipOnInsert<T>> {
  return applyDocumentOwnershipOnInsert(doc, {
    ...context,
    userId: ownerUserId ?? context.userId,
  });
}

export function withClassRuleFieldsFromContext<T extends Record<string, unknown>>(
  context: TenantStorageContext,
  doc: T,
  ownerUserId?: string,
  opts?: { scope?: 'global' | 'tenant' },
): ReturnType<typeof applyClassRuleOwnershipOnInsert<T>> {
  return applyClassRuleOwnershipOnInsert(
    doc,
    { ...context, userId: ownerUserId ?? context.userId },
    opts,
  );
}
