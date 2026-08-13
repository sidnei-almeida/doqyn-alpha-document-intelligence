import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import {
  resolveExternalSharingConfig,
  type ExternalSharingTenantConfig,
} from '../../config/externalSharingConfig.js';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  ExternalDocumentSharePermissions,
  MongoDocument,
  MongoExternalDocumentShareGrant,
} from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import { loadDocumentAccessContext } from '../../tenancy/documentAccess.js';
import { canUserShareDocument } from '../../tenancy/documentShareAccess.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { getTenantById } from '../tenantsService.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { normalizeEmail, isValidEmail, parseOptionalRecipientPhone, INVALID_RECIPIENT_PHONE_MESSAGE } from '../../utils/contactNormalize.js';
import type { DocumentAuditContext } from '../../audit/documentAuditTypes.js';
import { hashTrackingValue } from '../tracking/trackingSecurity.js';
import {
  generateExternalShareInviteToken,
  hashExternalShareToken,
} from './externalShareTokens.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

function defaultExternalPermissions(
  input?: Partial<ExternalDocumentSharePermissions>,
): ExternalDocumentSharePermissions {
  return {
    canView: input?.canView !== false,
    canDownload: input?.canDownload === true,
  };
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Recusa data inválida, no passado, ou além do teto de validade do ambiente.
 *
 * O acesso externo não é reavaliado depois de concedido: o link continua valendo mesmo quando quem
 * o criou deixa a empresa. A validade é o único mecanismo que fecha o link sozinho, então deixá-la
 * ilimitada equivalia a permitir acesso permanente a documento da empresa.
 */
function assertExpirationWithinLimit(
  expiresAt: Date,
  config: ExternalSharingTenantConfig,
  now: Date,
): void {
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    throw new ServiceError('Data de expiração inválida.', 'INVALID_EXPIRES_AT', 400);
  }

  const limit = addDays(now, config.maxExternalShareExpirationDays);
  if (expiresAt.getTime() > limit.getTime()) {
    throw new ServiceError(
      `A validade do compartilhamento externo não pode passar de ${config.maxExternalShareExpirationDays} dias.`,
      'EXPIRES_AT_ABOVE_LIMIT',
      400,
    );
  }
}

function maskRecipientEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

function emptyRecipientPhoneFields() {
  return {
    recipientPhone: null,
    recipientPhoneNormalized: null,
    recipientPhoneCountryCode: null,
    recipientPhoneMasked: null,
  };
}

function resolveRecipientPhoneFields(value?: string | null) {
  if (!value?.trim()) return emptyRecipientPhoneFields();
  try {
    const parsed = parseOptionalRecipientPhone(value);
    if (!parsed) return emptyRecipientPhoneFields();
    return parsed;
  } catch {
    throw new ServiceError(INVALID_RECIPIENT_PHONE_MESSAGE, 'INVALID_RECIPIENT_PHONE', 400);
  }
}

async function getExternalShareGrantsCollection(): Promise<
  Collection<MongoExternalDocumentShareGrant>
> {
  const db = await getDb();
  return db.collection<MongoExternalDocumentShareGrant>(
    SHARED_APP_COLLECTIONS.externalDocumentShareGrants,
  );
}

function isGrantAccessWindowOpen(grant: MongoExternalDocumentShareGrant): boolean {
  if (grant.status === 'revoked' || grant.status === 'expired') return false;
  if (grant.inviteExpiresAt.getTime() <= Date.now() && grant.status === 'pending') return false;
  if (grant.expiresAt && grant.expiresAt.getTime() <= Date.now()) return false;
  return grant.status === 'active' || grant.status === 'pending';
}

export function buildExternalShareInvitePath(token: string): string {
  return `/guest/share/${encodeURIComponent(token)}`;
}

export function buildExternalShareInviteUrl(token: string, origin?: string): string {
  const base = origin?.trim() || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}${buildExternalShareInvitePath(token)}`;
}

export async function findExternalShareGrantByToken(
  token: string,
): Promise<MongoExternalDocumentShareGrant | null> {
  if (!isMongoNativeConfigured() || !token?.trim()) return null;
  const collection = await getExternalShareGrantsCollection();
  return collection.findOne({ inviteTokenHash: hashExternalShareToken(token) });
}

async function loadShareableDocumentForExternal(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
): Promise<{
  doc: MongoDocument;
}> {
  // Sem o índice de governança o verbo `share` do mapa de regras não é lido e só admin e dono
  // conseguiriam compartilhar externamente.
  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    const trashed = await documents.findOne({
      _id: documentId,
      ...tenantScopeFilterFromContext(storage),
    } as Record<string, unknown>);
    if (
      trashed &&
      ((trashed as MongoDocument).deletedAt ||
        (trashed as MongoDocument).permanentlyDeletedAt ||
        (trashed as MongoDocument).deactivatedAt)
    ) {
      throw new ServiceError('Documento na lixeira não pode ser compartilhado.', 'DOCUMENT_TRASHED', 400);
    }
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  if (!canUserShareDocument(user, doc as MongoDocument, memberGroupIds, governanceIndex)) {
    throw new ServiceError(
      'Você não tem permissão para compartilhar este documento externamente.',
      'DOCUMENT_EXTERNAL_SHARE_DENIED',
      403,
    );
  }

  return { doc: doc as MongoDocument };
}

export async function listDocumentExternalShareGrants(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  await loadShareableDocumentForExternal(ctx, user, documentId);
  const collection = await getExternalShareGrantsCollection();
  const grants = await collection
    .find({ documentId, tenantId: ctx.tenantId })
    .sort({ createdAt: -1 })
    .toArray();

  return {
    documentId,
    shares: grants.map((grant) => serializeExternalShareGrant(grant)),
  };
}

function serializeExternalShareGrant(grant: MongoExternalDocumentShareGrant) {
  return {
    shareId: grant._id,
    recipientEmail: grant.recipientEmail,
    recipientPhoneMasked: grant.recipientPhoneMasked ?? null,
    recipientName: grant.recipientName ?? null,
    recipientOrganizationName: grant.recipientOrganizationName ?? null,
    permissions: grant.permissions,
    status: grant.status,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
    inviteExpiresAt: grant.inviteExpiresAt.toISOString(),
    acceptedAt: grant.acceptedAt?.toISOString() ?? null,
    lastAccessAt: grant.lastAccessAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
    sharedByUserId: grant.sharedByUserId,
    sharedByNameSnapshot: grant.sharedByNameSnapshot ?? null,
    message: grant.message ?? null,
  };
}

export async function createDocumentExternalShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  input: {
    recipientEmail: string;
    recipientPhone?: string;
    recipientName?: string;
    recipientOrganizationName?: string;
    recipientTaxId?: string;
    permissions?: Partial<ExternalDocumentSharePermissions>;
    expiresAt?: string;
    message?: string;
    inviteOrigin?: string;
  },
) {
  const config = resolveExternalSharingConfig();
  if (!config.externalSharingEnabled) {
    throw new ServiceError(
      'Compartilhamento externo desabilitado para este ambiente.',
      'EXTERNAL_SHARING_DISABLED',
      403,
    );
  }

  const recipientEmail = normalizeEmail(input.recipientEmail ?? '');
  if (!isValidEmail(recipientEmail)) {
    throw new ServiceError('E-mail do destinatário inválido.', 'INVALID_RECIPIENT_EMAIL', 400);
  }

  const phoneFields = resolveRecipientPhoneFields(input.recipientPhone);

  const { doc } = await loadShareableDocumentForExternal(ctx, user, documentId);
  const permissions = defaultExternalPermissions(input.permissions);
  if (!permissions.canView) {
    throw new ServiceError('canView é obrigatório para compartilhamento.', 'INVALID_SHARE_PERMISSIONS', 400);
  }
  if (!config.defaultCanDownload && permissions.canDownload) {
    // download externo permitido quando explicitamente solicitado
  }

  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : addDays(new Date(), config.defaultExternalShareExpirationDays);
  assertExpirationWithinLimit(expiresAt, config, new Date());

  const collection = await getExternalShareGrantsCollection();
  const now = new Date();
  const existing = await collection.findOne({
    documentId,
    recipientEmailNormalized: recipientEmail,
    status: { $in: ['active', 'pending'] },
  });

  const inviteToken = generateExternalShareInviteToken();
  const inviteTokenHash = hashExternalShareToken(inviteToken);
  const inviteExpiresAt = addDays(now, config.defaultInviteExpirationDays);

  if (existing) {
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          recipientName: input.recipientName?.trim() || null,
          recipientOrganizationName: input.recipientOrganizationName?.trim() || null,
          recipientTaxId: input.recipientTaxId?.trim() || null,
          ...phoneFields,
          permissions,
          message: input.message?.trim() || null,
          status: 'pending',
          inviteTokenHash,
          inviteExpiresAt,
          expiresAt,
          acceptedAt: null,
          updatedAt: now,
          revokedAt: null,
          revokedBy: null,
        },
      },
    );

    return {
      shareId: existing._id,
      documentId,
      recipientEmail,
      recipientPhoneMasked: phoneFields.recipientPhoneMasked,
      permissions,
      status: 'pending' as const,
      updated: true,
      inviteToken,
      invitePath: buildExternalShareInvitePath(inviteToken),
      inviteUrl: buildExternalShareInviteUrl(inviteToken, input.inviteOrigin),
      currentVersionId: doc.currentVersionId,
    };
  }

  const grant: MongoExternalDocumentShareGrant = {
    _id: `extshare_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    documentId,
    tenantId: ctx.tenantId,
    documentTenantType: ctx.tenantType === 'individual' ? 'individual' : 'business',
    sharedByUserId: user.id,
    sharedByNameSnapshot: user.name?.trim() || user.email,
    recipientEmail,
    recipientEmailNormalized: recipientEmail,
    ...phoneFields,
    recipientName: input.recipientName?.trim() || null,
    recipientOrganizationName: input.recipientOrganizationName?.trim() || null,
    recipientTaxId: input.recipientTaxId?.trim() || null,
    permissions,
    status: 'pending',
    message: input.message?.trim() || null,
    inviteTokenHash,
    inviteExpiresAt,
    acceptedAt: null,
    lastAccessAt: null,
    accessCodeHash: null,
    accessCodeExpiresAt: null,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    revokedBy: null,
  };

  await collection.insertOne(grant);

  return {
    shareId: grant._id,
    documentId,
    recipientEmail,
    recipientPhoneMasked: phoneFields.recipientPhoneMasked,
    permissions,
    status: grant.status,
    updated: false,
    inviteToken,
    invitePath: buildExternalShareInvitePath(inviteToken),
    inviteUrl: buildExternalShareInviteUrl(inviteToken, input.inviteOrigin),
    currentVersionId: doc.currentVersionId,
  };
}

export async function revokeDocumentExternalShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  shareId: string,
) {
  const { doc } = await loadShareableDocumentForExternal(ctx, user, documentId);
  const collection = await getExternalShareGrantsCollection();
  const grant = await collection.findOne({
    _id: shareId,
    documentId,
    tenantId: ctx.tenantId,
  });

  if (!grant) {
    throw new ServiceError('Compartilhamento externo não encontrado.', 'EXTERNAL_SHARE_NOT_FOUND', 404);
  }

  if (grant.status === 'revoked') {
    return { shareId, documentId, currentVersionId: doc.currentVersionId, alreadyRevoked: true };
  }

  const now = new Date();
  await collection.updateOne(
    { _id: shareId },
    {
      $set: {
        status: 'revoked',
        revokedAt: now,
        revokedBy: user.id,
        updatedAt: now,
      },
    },
  );

  return { shareId, documentId, currentVersionId: doc.currentVersionId, alreadyRevoked: false };
}

export async function regenerateDocumentExternalShareGrant(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  shareId: string,
  input?: { inviteOrigin?: string; expiresAt?: string },
) {
  const config = resolveExternalSharingConfig();
  if (!config.externalSharingEnabled) {
    throw new ServiceError(
      'Compartilhamento externo desabilitado para este ambiente.',
      'EXTERNAL_SHARING_DISABLED',
      403,
    );
  }

  const { doc } = await loadShareableDocumentForExternal(ctx, user, documentId);
  const collection = await getExternalShareGrantsCollection();
  const grant = await collection.findOne({
    _id: shareId,
    documentId,
    tenantId: ctx.tenantId,
  });

  if (!grant) {
    throw new ServiceError('Compartilhamento externo não encontrado.', 'EXTERNAL_SHARE_NOT_FOUND', 404);
  }

  const now = new Date();
  const inviteToken = generateExternalShareInviteToken();
  const inviteTokenHash = hashExternalShareToken(inviteToken);
  const inviteExpiresAt = addDays(now, config.defaultInviteExpirationDays);

  let expiresAt = grant.expiresAt;
  if (input?.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    assertExpirationWithinLimit(expiresAt, config, now);
  } else if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
    expiresAt = addDays(now, config.defaultExternalShareExpirationDays);
  }

  const conflictingGrant = await collection.findOne({
    documentId,
    recipientEmailNormalized: grant.recipientEmailNormalized,
    status: { $in: ['active', 'pending'] },
    _id: { $ne: shareId },
  });

  if (conflictingGrant) {
    await collection.updateOne(
      { _id: conflictingGrant._id },
      {
        $set: {
          status: 'revoked',
          revokedAt: now,
          revokedBy: user.id,
          updatedAt: now,
        },
      },
    );
  }

  await collection.updateOne(
    { _id: shareId },
    {
      $set: {
        status: 'pending',
        inviteTokenHash,
        inviteExpiresAt,
        expiresAt,
        acceptedAt: null,
        revokedAt: null,
        revokedBy: null,
        updatedAt: now,
      },
    },
  );

  return {
    shareId,
    documentId,
    recipientEmail: grant.recipientEmail,
    permissions: grant.permissions,
    status: 'pending' as const,
    inviteToken,
    invitePath: buildExternalShareInvitePath(inviteToken),
    inviteUrl: buildExternalShareInviteUrl(inviteToken, input?.inviteOrigin),
    currentVersionId: doc.currentVersionId,
  };
}

export type ExternalShareAccessResult =
  | { grant: MongoExternalDocumentShareGrant; reason?: undefined }
  | { grant: null; reason: 'not_found' | 'revoked' | 'expired' | 'invite_expired' | 'document_unavailable' | 'denied' };

export async function resolveExternalShareAccess(
  token: string,
  options: { requireActive?: boolean; touchAccess?: boolean } = {},
): Promise<ExternalShareAccessResult> {
  const grant = await findExternalShareGrantByToken(token);
  if (!grant) return { grant: null, reason: 'not_found' };

  if (grant.status === 'revoked') return { grant: null, reason: 'revoked' };

  const now = new Date();
  if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) {
    if (grant.status !== 'expired') {
      const collection = await getExternalShareGrantsCollection();
      await collection.updateOne(
        { _id: grant._id },
        { $set: { status: 'expired', updatedAt: now } },
      );
    }
    return { grant: null, reason: 'expired' };
  }

  if (grant.status === 'expired') return { grant: null, reason: 'expired' };

  if (grant.status === 'pending' && grant.inviteExpiresAt.getTime() <= now.getTime()) {
    return { grant: null, reason: 'invite_expired' };
  }

  if (options.requireActive && grant.status !== 'active') {
    return { grant: null, reason: 'denied' };
  }

  if (!isGrantAccessWindowOpen(grant)) {
    return { grant: null, reason: 'denied' };
  }

  const docAvailable = await isExternalShareDocumentAvailable(grant);
  if (!docAvailable) return { grant: null, reason: 'document_unavailable' };

  if (options.touchAccess) {
    const collection = await getExternalShareGrantsCollection();
    await collection.updateOne(
      { _id: grant._id },
      { $set: { lastAccessAt: now, updatedAt: now } },
    );
    grant.lastAccessAt = now;
  }

  return { grant };
}

export async function isExternalShareDocumentAvailable(
  grant: MongoExternalDocumentShareGrant,
): Promise<boolean> {
  if (!isMongoNativeConfigured()) return false;
  const { documents, storage } = await getTenantCollections(grant.tenantId, {
    userId: grant.sharedByUserId,
  });
  const doc = await documents.findOne({
    _id: grant.documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);
  if (!doc) return false;
  const typed = doc as MongoDocument;
  return !typed.deletedAt && !typed.permanentlyDeletedAt && !typed.deactivatedAt;
}

export async function acceptExternalShareInvite(token: string) {
  const access = await resolveExternalShareAccess(token);
  if (!access.grant) {
    throw mapExternalShareDenial(access.reason ?? 'denied');
  }

  if (access.grant.status === 'active') {
    return { shareId: access.grant._id, status: 'active' as const, alreadyAccepted: true };
  }

  if (access.grant.status !== 'pending') {
    throw mapExternalShareDenial(
      access.grant.status === 'revoked'
        ? 'revoked'
        : access.grant.status === 'expired'
          ? 'expired'
          : 'denied',
    );
  }

  const now = new Date();
  const collection = await getExternalShareGrantsCollection();
  const updateResult = await collection.updateOne(
    { _id: access.grant._id, status: 'pending' },
    {
      $set: {
        status: 'active',
        acceptedAt: now,
        updatedAt: now,
        lastAccessAt: now,
      },
    },
  );

  if (updateResult.modifiedCount === 0) {
    const refreshed = await collection.findOne({ _id: access.grant._id });
    if (refreshed?.status === 'active') {
      return { shareId: access.grant._id, status: 'active' as const, alreadyAccepted: true };
    }
    throw mapExternalShareDenial('denied');
  }

  return { shareId: access.grant._id, status: 'active' as const, alreadyAccepted: false };
}

function mapExternalShareDenial(reason: string): ServiceError {
  switch (reason) {
    case 'not_found':
      return new ServiceError('Convite não encontrado.', 'EXTERNAL_SHARE_NOT_FOUND', 404);
    case 'revoked':
      return new ServiceError('Este compartilhamento foi revogado.', 'EXTERNAL_SHARE_REVOKED', 403);
    case 'expired':
      return new ServiceError('Este compartilhamento expirou.', 'EXTERNAL_SHARE_EXPIRED', 403);
    case 'invite_expired':
      return new ServiceError('Este convite expirou.', 'EXTERNAL_SHARE_INVITE_EXPIRED', 403);
    case 'document_unavailable':
      return new ServiceError('Documento indisponível.', 'EXTERNAL_SHARE_DOCUMENT_UNAVAILABLE', 403);
    default:
      return new ServiceError('Acesso negado.', 'EXTERNAL_SHARE_DENIED', 403);
  }
}

export async function getExternalSharePortalPayload(token: string) {
  const access = await resolveExternalShareAccess(token);
  if (!access.grant) {
    throw mapExternalShareDenial(access.reason ?? 'denied');
  }

  const grant = access.grant;
  const tenant = await getTenantById(grant.tenantId);
  const { documents, storage } = await getTenantCollections(grant.tenantId, {
    userId: grant.sharedByUserId,
  });
  const doc = await documents.findOne({
    _id: grant.documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento indisponível.', 'EXTERNAL_SHARE_DOCUMENT_UNAVAILABLE', 403);
  }

  const typed = doc as MongoDocument;

  return {
    shareId: grant._id,
    status: grant.status,
    permissions: grant.permissions,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
    inviteExpiresAt: grant.inviteExpiresAt.toISOString(),
    sharedAt: grant.createdAt.toISOString(),
    sharedByName: grant.sharedByNameSnapshot ?? 'Usuário',
    ownerTenantName: tenant?.displayName ?? grant.tenantId,
    recipientEmail: grant.recipientEmail,
    recipientName: grant.recipientName ?? null,
    recipientOrganizationName: grant.recipientOrganizationName ?? null,
    message: grant.message ?? null,
    document: {
      documentId: typed._id,
      displayName: typed.currentFileName || typed.title,
      categoryName: typed.className,
      versionLabel: typed.currentVersionLabel ?? null,
      versionId: typed.currentVersionId,
      mimeType: null as string | null,
    },
  };
}

export function buildExternalShareTrackingMetadata(
  grant: MongoExternalDocumentShareGrant,
  extra: Record<string, unknown> = {},
) {
  return {
    shareId: grant._id,
    recipientEmailMasked: maskRecipientEmail(grant.recipientEmail),
    recipientEmailHash: hashTrackingValue(grant.recipientEmail, 'doqyn-external-share-email-v1'),
    recipientPhoneMasked: grant.recipientPhoneMasked ?? undefined,
    recipientPhoneHash: grant.recipientPhoneNormalized
      ? hashTrackingValue(grant.recipientPhoneNormalized, 'doqyn-external-share-phone-v1')
      : undefined,
    recipientOrganizationName: grant.recipientOrganizationName ?? undefined,
    permissions: grant.permissions,
    expiresAt: grant.expiresAt?.toISOString(),
    source: 'external_share',
    ...extra,
  };
}

export function buildExternalShareAuditContext(
  grant: MongoExternalDocumentShareGrant,
  requestId?: string,
): DocumentAuditContext {
  return {
    tenantId: grant.tenantId,
    tenantType: grant.documentTenantType ?? 'business',
    collectionPrefix: grant.tenantId,
    ownerTenantId: grant.tenantId,
    ownerUserId: grant.sharedByUserId,
    actorUserId: grant.sharedByUserId,
    actorDisplayName: grant.sharedByNameSnapshot,
    requestId,
  };
}
