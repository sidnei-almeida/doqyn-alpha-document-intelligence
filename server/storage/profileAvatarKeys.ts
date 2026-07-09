import { ServiceError } from '../utils/serviceErrors.js';

const SAFE_USER_ID = /^[0-9a-f-]{8,64}$/i;

export function assertSafeProfileUserId(userId: string): void {
  if (!userId?.trim() || !SAFE_USER_ID.test(userId.trim())) {
    throw new ServiceError('userId inválido para avatar.', 'INVALID_USER_ID', 400);
  }
}

export function buildProfileAvatarBaseKey(userId: string, version: number): string {
  assertSafeProfileUserId(userId);
  if (!Number.isInteger(version) || version < 1) {
    throw new ServiceError('Versão de avatar inválida.', 'INVALID_AVATAR_VERSION', 400);
  }
  return `profiles/users/${userId}/avatar/v${version}`;
}

export function buildProfileAvatarVariantKey(input: {
  userId: string;
  version: number;
  size: number;
  extension: 'webp' | 'png';
}): string {
  const base = buildProfileAvatarBaseKey(input.userId, input.version);
  return `${base}/avatar_${input.size}.${input.extension}`;
}

export function buildProfileAvatarPrefix(userId: string, version: number): string {
  return `${buildProfileAvatarBaseKey(userId, version)}/`;
}

export function resolveProfileAvatarLocalPath(root: string, objectKey: string): string {
  if (!objectKey.startsWith('profiles/users/') || objectKey.includes('..')) {
    throw new ServiceError('Chave de avatar inválida.', 'INVALID_AVATAR_KEY', 400);
  }
  return `${root.replace(/\/+$/, '')}/${objectKey}`;
}
