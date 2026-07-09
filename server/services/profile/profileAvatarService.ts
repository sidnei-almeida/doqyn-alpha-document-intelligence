import type { VercelRequest } from '@vercel/node';
import type { AuthUser } from '../../auth/types.js';
import {
  fetchUserAvatarMetadata,
  updateUserAvatarMetadata,
} from '../../integrations/doqynAuthInternalClient.js';
import { isLocalStorageEnabled, isR2StorageEnabled } from '../../storage/storageConfig.js';
import {
  buildProfileAvatarUrl,
  getProfileAvatarConfig,
} from './profileAvatarConfig.js';
import { processProfileAvatarImage } from './profileAvatarProcessor.js';
import { profileAvatarStorage } from './profileAvatarStorage.js';
import { validateProfileAvatarUpload } from './validateProfileAvatar.js';
import { buildProfileAvatarVariantKey } from '../../storage/profileAvatarKeys.js';
import { emitTrackingEvent } from '../tracking/trackingService.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../utils/sanitizeAuditMetadata.js';

export type ProfileAvatarPublic = {
  status: 'active' | 'removed' | null;
  version: number;
  updatedAt?: string;
  url?: string;
};

export type ProfileMeResponse = {
  userId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  authProvider?: string;
  avatar: ProfileAvatarPublic;
  tenant: {
    tenantId: string;
    displayName: string;
    tenantType?: string;
  };
  roles: string[];
};

function resolveStorageProvider(): 'r2' | 'local' {
  if (isR2StorageEnabled()) return 'r2';
  if (isLocalStorageEnabled()) return 'local';
  throw new ServiceError('Storage de avatar indisponível.', 'AVATAR_STORAGE_UNAVAILABLE', 503);
}

function mapAvatarPublic(input: {
  userId: string;
  version: number;
  status: string | null;
  updatedAt?: string;
  self?: boolean;
}): ProfileAvatarPublic {
  const status = input.status === 'active' ? 'active' : input.status === 'removed' ? 'removed' : null;
  if (status !== 'active' || input.version < 1) {
    return { status, version: input.version, updatedAt: input.updatedAt };
  }

  return {
    status,
    version: input.version,
    updatedAt: input.updatedAt,
    url: buildProfileAvatarUrl({
      userId: input.userId,
      version: input.version,
      size: 128,
      self: input.self ?? true,
    }),
  };
}

export function buildProfileMeResponse(user: AuthUser, sessionUser?: {
  avatarVersion?: number;
  avatarUpdatedAt?: string | null;
  avatarStatus?: 'active' | 'removed' | null;
}): ProfileMeResponse {
  const version = sessionUser?.avatarVersion ?? 0;
  const status = sessionUser?.avatarStatus ?? null;

  return {
    userId: user.id,
    email: user.email,
    displayName: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    authProvider: user.authProvider,
    avatar: mapAvatarPublic({
      userId: user.id,
      version,
      status,
      updatedAt: sessionUser?.avatarUpdatedAt ?? undefined,
      self: true,
    }),
    tenant: {
      tenantId: user.tenantId ?? user.companyId,
      displayName: user.companyName,
      tenantType: user.tenantType,
    },
    roles: user.platformRoles ?? [],
  };
}

async function emitAvatarTracking(
  user: AuthUser,
  req: VercelRequest | undefined,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const auditCtx: import('../../audit/documentAuditTypes.js').DocumentAuditContext = {
    tenantId: user.tenantId ?? user.companyId,
    tenantType: user.tenantType === 'individual' ? 'individual' : 'business',
    collectionPrefix: user.tenantId ?? user.companyId,
    ownerUserId: user.id,
    actorUserId: user.id,
    actorMembershipId: user.membershipId ?? user.memberId,
    actorRoles: user.platformRoles,
    actorDisplayName: user.name,
    actorEmail: user.email,
    actorRole: user.role,
  };

  await emitTrackingEvent(
    auditCtx,
    {
      action,
      description: action,
      metadata: sanitizeAuditMetadata(metadata),
    },
    req,
  );
}

export async function uploadProfileAvatar(input: {
  user: AuthUser;
  buffer: Buffer;
  mimeType: string;
  originalFileName?: string;
  req?: VercelRequest;
}): Promise<ProfileMeResponse> {
  const { mimeType } = validateProfileAvatarUpload({
    buffer: input.buffer,
    declaredMimeType: input.mimeType,
    originalFileName: input.originalFileName,
  });

  const processed = await processProfileAvatarImage({ buffer: input.buffer, mimeType });
  const current = await fetchUserAvatarMetadata(input.user.id);
  const nextVersion = Math.max(current.version ?? 0, 0) + 1;
  const provider = resolveStorageProvider();
  const config = getProfileAvatarConfig();

  let primaryKey = '';
  let primarySize = 0;

  for (const variant of processed.variants) {
    const key = await profileAvatarStorage.storeVariant({
      userId: input.user.id,
      version: nextVersion,
      size: variant.size,
      extension: variant.extension,
      buffer: variant.buffer,
      contentType: variant.contentType,
    });
    if (variant.size === processed.primarySize) {
      primaryKey = key;
      primarySize = variant.buffer.length;
    }
  }

  if (!primaryKey) {
    const fallback = processed.variants[processed.variants.length - 1];
    primaryKey = buildProfileAvatarVariantKey({
      userId: input.user.id,
      version: nextVersion,
      size: fallback.size,
      extension: fallback.extension,
    });
    primarySize = fallback.buffer.length;
  }

  await updateUserAvatarMetadata(input.user.id, {
    storageProvider: provider,
    objectKey: primaryKey,
    contentType: config.outputFormat === 'png' ? 'image/png' : 'image/webp',
    version: nextVersion,
    size: primarySize,
    status: 'active',
  });

  await emitAvatarTracking(input.user, input.req, 'user.avatar_uploaded', {
    avatarVersion: nextVersion,
    contentType: config.outputFormat === 'png' ? 'image/png' : 'image/webp',
    size: primarySize,
    variantCount: processed.variants.length,
  });

  return buildProfileMeResponse(input.user, {
    avatarVersion: nextVersion,
    avatarStatus: 'active',
    avatarUpdatedAt: new Date().toISOString(),
  });
}

export async function removeProfileAvatar(input: {
  user: AuthUser;
  req?: VercelRequest;
}): Promise<ProfileMeResponse> {
  const current = await fetchUserAvatarMetadata(input.user.id);
  const nextVersion = Math.max(current.version ?? 0, 0) + 1;

  if (current.status === 'active' && current.version > 0) {
    await profileAvatarStorage.deleteVersionPrefix(input.user.id, current.version).catch(() => undefined);
  }

  await updateUserAvatarMetadata(input.user.id, {
    storageProvider: null,
    objectKey: null,
    contentType: null,
    version: nextVersion,
    status: 'removed',
  });

  await emitAvatarTracking(input.user, input.req, 'user.avatar_removed', {
    avatarVersion: nextVersion,
  });

  return buildProfileMeResponse(input.user, {
    avatarVersion: nextVersion,
    avatarStatus: 'removed',
    avatarUpdatedAt: new Date().toISOString(),
  });
}

export async function readProfileAvatarBytes(input: {
  userId: string;
  size?: number;
  version?: number;
}): Promise<{ buffer: Buffer; contentType: string; etag?: string }> {
  const metadata = await fetchUserAvatarMetadata(input.userId);
  if (metadata.status !== 'active' || !metadata.objectKey || metadata.version < 1) {
    throw new ServiceError('Avatar não encontrado.', 'AVATAR_NOT_FOUND', 404);
  }

  if (input.version && input.version !== metadata.version) {
    throw new ServiceError('Versão de avatar não encontrada.', 'AVATAR_VERSION_NOT_FOUND', 404);
  }

  const config = getProfileAvatarConfig();
  const size = input.size && config.sizes.includes(input.size) ? input.size : 128;
  const extension = metadata.contentType === 'image/png' ? 'png' : 'webp';
  const variantKey = buildProfileAvatarVariantKey({
    userId: input.userId,
    version: metadata.version,
    size,
    extension,
  });

  try {
    const file = await profileAvatarStorage.readVariant(variantKey);
    return {
      buffer: file.buffer,
      contentType: file.contentType,
      etag: `"avatar-${input.userId}-v${metadata.version}-${size}"`,
    };
  } catch {
    const fallback = await profileAvatarStorage.readVariant(metadata.objectKey);
    return {
      buffer: fallback.buffer,
      contentType: fallback.contentType,
      etag: `"avatar-${input.userId}-v${metadata.version}"`,
    };
  }
}

export async function assertCanViewUserAvatar(input: {
  requester: AuthUser;
  targetUserId: string;
}): Promise<void> {
  if (input.requester.id === input.targetUserId) return;

  // Mesmo tenant: permitir visualização em listagens/tracking.
  if (!input.requester.tenantId && !input.requester.companyId) {
    throw new ServiceError('Acesso ao avatar negado.', 'AVATAR_FORBIDDEN', 403);
  }
}
