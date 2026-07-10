import type { VercelRequest } from '@vercel/node';
import type { AuthUser } from '../auth/types.js';
import { getTenantIdFromUser } from '../auth/tenantContext.js';
import { usesDoqynAuth } from '../auth/authConfig.js';
import { verifyDoqynAuthSession, mapDoqynSessionToAuthUser } from '../auth/providers/doqynAuthProvider.js';
import { requireAuth } from '../auth/requireAuth.js';
import type { TenantType } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { ensureTenantMembersSyncedForOperations } from '../services/tenantMemberSyncService.js';
import { getTenantCollections, type TenantCollections } from './getTenantCollections.js';
import {
  resolveTenantStorageScope,
  resolveTenantStorageScopeForTenant,
  type TenantStorageScope,
} from './resolveTenantStorageScope.js';
import type { TenantStorageContext } from './tenantStorage.js';

export type DocumentRequestContext = {
  tenantId: string;
  userId: string;
  membershipId?: string;
  tenantType?: string;
  storage: TenantStorageContext;
  storageScope: TenantStorageScope;
  collections: TenantCollections;
};

function normalizeTenantType(value: string | undefined): TenantType {
  return value === 'individual' ? 'individual' : 'business';
}

function buildStorageScope(input: {
  tenantId: string;
  tenantType: TenantType;
  userId: string;
  displayName?: string;
  tenantSlug?: string;
}): TenantStorageScope {
  return resolveTenantStorageScope({
    tenantId: input.tenantId,
    tenantType: input.tenantType,
    ownerUserId: input.userId,
    displayName: input.displayName,
    tenantSlug: input.tenantSlug,
  });
}

async function buildStorageScopeFromTenant(
  tenant: import('../db/types.js').MongoTenant,
  userId: string,
): Promise<TenantStorageScope> {
  return resolveTenantStorageScopeForTenant(tenant, userId);
}

export function resolveTenantStorageScopeFromAuthUser(user: AuthUser): TenantStorageScope {
  const tenantId = getTenantIdFromUser(user);
  const userId = user.id?.trim();
  if (!userId) {
    throw new ServiceError(
      'Contexto de usuário incompleto.',
      'OWNER_CONTEXT_REQUIRED',
      400,
    );
  }

  return buildStorageScope({
    tenantId,
    tenantType: normalizeTenantType(user.tenantType),
    userId,
  });
}

export function resolveDocumentContextFromUser(user: AuthUser): {
  tenantId: string;
  userId: string;
  membershipId?: string;
} {
  const tenantId = getTenantIdFromUser(user);
  const userId = user.id?.trim();

  if (!userId) {
    throw new ServiceError(
      'Contexto de usuário incompleto.',
      'OWNER_CONTEXT_REQUIRED',
      400,
    );
  }

  return {
    tenantId,
    userId,
    membershipId: user.membershipId ?? user.memberId,
  };
}

export async function buildDocumentRequestContext(
  user: AuthUser,
): Promise<DocumentRequestContext> {
  const base = resolveDocumentContextFromUser(user);
  const collections = await getTenantCollections(base.tenantId, {
    userId: base.userId,
    membershipId: base.membershipId,
  });

  return {
    ...base,
    tenantType: collections.tenant.tenantType,
    storage: collections.storage,
    storageScope: await buildStorageScopeFromTenant(collections.tenant, base.userId),
    collections,
  };
}

export type DocumentAuthContext = {
  ctx: DocumentRequestContext;
  user: AuthUser;
};

export async function requireDocumentAuthContext(
  req: VercelRequest,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<DocumentAuthContext | null> {
  if (usesDoqynAuth()) {
    const session = await verifyDoqynAuthSession(req);
    if (!session?.activeMembership) {
      res.status(401).json({
        message: 'Não autenticado.',
        code: 'INVALID_SESSION',
      });
      return null;
    }

    const { user, activeMembership } = session;
    const collections = await getTenantCollections(activeMembership.tenantId, {
      userId: user.id,
      membershipId: activeMembership.membershipId,
    });

    void ensureTenantMembersSyncedForOperations(activeMembership.tenantId);

    return {
      user: mapDoqynSessionToAuthUser(session),
      ctx: {
        tenantId: activeMembership.tenantId,
        userId: user.id,
        membershipId: activeMembership.membershipId,
        tenantType: activeMembership.tenantType,
        storage: collections.storage,
        storageScope: await buildStorageScopeFromTenant(collections.tenant, user.id),
        collections,
      },
    };
  }

  const user = await requireAuth(req, res as never);
  if (!user) return null;

  return {
    user,
    ctx: await buildDocumentRequestContext(user),
  };
}

export async function requireDocumentRequestContext(
  req: VercelRequest,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<DocumentRequestContext | null> {
  const auth = await requireDocumentAuthContext(req, res);
  return auth?.ctx ?? null;
}

export function assertQueryTenantMatchesSession(
  queryTenantId: string | undefined,
  ctx: DocumentRequestContext,
): void {
  if (!queryTenantId?.trim()) return;

  if (queryTenantId.trim() !== ctx.tenantId) {
    throw new ServiceError('Tenant da requisição não corresponde à sessão.', 'TENANT_MISMATCH', 403);
  }
}
