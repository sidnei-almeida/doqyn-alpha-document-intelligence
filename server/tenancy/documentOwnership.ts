import { ServiceError } from '../utils/serviceErrors.js';
import type { TenantStorageContext } from './tenantStorage.js';

/**
 * Coleções dedicadas (documents_{tenant}) já isolam por tenant.
 * Inclui documentos canônicos (tenantId/companyId) e legados sem esses campos.
 */
function buildDedicatedBusinessOwnershipFilter(tenantId: string): Record<string, unknown> {
  return {
    $or: [
      { tenantId },
      { companyId: tenantId },
      {
        tenantId: { $exists: false },
        companyId: { $exists: false },
      },
      {
        tenantId: { $in: [null, undefined] },
        companyId: { $in: [null, undefined] },
      },
    ],
  };
}

export function buildDocumentOwnershipFilter(context: TenantStorageContext): Record<string, unknown> {
  if (context.storageMode === 'shared_individual_collection') {
    if (!context.userId) {
      throw new ServiceError(
        'ownerUserId é obrigatório para consultas em storage compartilhado.',
        'OWNER_USER_REQUIRED',
        400,
      );
    }

    return {
      tenantType: 'individual',
      ownerTenantId: context.tenantId,
      ownerUserId: context.userId,
    };
  }

  return buildDedicatedBusinessOwnershipFilter(context.tenantId);
}

/** Classes/regras: sempre tenant-scoped — business por tenantId; PF por ownership do usuário. */
export function buildClassRuleOwnershipFilter(context: TenantStorageContext): Record<string, unknown> {
  return buildDocumentOwnershipFilter(context);
}

export function applyClassRuleOwnershipOnInsert<T extends Record<string, unknown>>(
  payload: T,
  context: TenantStorageContext,
  opts?: { scope?: 'global' | 'tenant' },
): ReturnType<typeof applyDocumentOwnershipOnInsert<T>> & { scope?: string } {
  const scope = opts?.scope ?? (context.storageMode === 'shared_individual_collection' ? 'tenant' : undefined);
  const base = applyDocumentOwnershipOnInsert(payload, context);
  return scope ? { ...base, scope } : base;
}

export function applyDocumentOwnershipOnInsert<T extends Record<string, unknown>>(
  payload: T,
  context: TenantStorageContext,
): T & {
  tenantId: string;
  companyId: string;
  tenantType: 'individual' | 'business';
  ownerTenantId: string;
  ownerUserId?: string;
} {
  const ownerUserId = context.userId ?? (typeof payload.ownerUserId === 'string' ? payload.ownerUserId : undefined);

  if (context.storageMode === 'shared_individual_collection') {
    if (!ownerUserId) {
      throw new ServiceError(
        'ownerUserId é obrigatório para gravação em storage compartilhado.',
        'OWNER_USER_REQUIRED',
        400,
      );
    }

    return {
      ...payload,
      tenantType: 'individual',
      tenantId: context.tenantId,
      companyId: context.tenantId,
      ownerTenantId: context.tenantId,
      ownerUserId,
    };
  }

  return {
    ...payload,
    tenantType: 'business',
    tenantId: context.tenantId,
    companyId: context.tenantId,
    ownerTenantId: context.tenantId,
    ...(ownerUserId ? { ownerUserId } : {}),
  };
}

export function assertCanAccessDocument(
  document: Record<string, unknown> | null | undefined,
  context: TenantStorageContext,
): void {
  if (!document) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  if (context.storageMode === 'shared_individual_collection') {
    if (!context.userId) {
      throw new ServiceError(
        'ownerUserId é obrigatório para acesso em storage compartilhado.',
        'OWNER_USER_REQUIRED',
        400,
      );
    }
    if (document.tenantType !== 'individual') {
      throw new ServiceError('Documento inacessível.', 'DOCUMENT_FORBIDDEN', 403);
    }
    if (document.ownerTenantId !== context.tenantId) {
      throw new ServiceError('Documento inacessível.', 'DOCUMENT_FORBIDDEN', 403);
    }
    if (document.ownerUserId !== context.userId) {
      throw new ServiceError('Documento inacessível.', 'DOCUMENT_FORBIDDEN', 403);
    }
    return;
  }

  if (context.storageMode === 'dedicated_collections') {
    const tenantId = document.tenantId ?? document.companyId;
    if (tenantId && tenantId !== context.tenantId) {
      throw new ServiceError('Documento inacessível.', 'DOCUMENT_FORBIDDEN', 403);
    }
    return;
  }

  const tenantId = document.tenantId ?? document.companyId;
  if (tenantId !== context.tenantId) {
    throw new ServiceError('Documento inacessível.', 'DOCUMENT_FORBIDDEN', 403);
  }
}
