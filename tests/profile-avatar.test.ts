import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServiceError } from '../server/utils/serviceErrors.js';
import { validateProfileAvatarUpload } from '../server/services/profile/validateProfileAvatar.js';
import {
  buildProfileAvatarVariantKey,
  assertSafeProfileUserId,
} from '../server/storage/profileAvatarKeys.js';
import { buildProfileAvatarUrl } from '../server/services/profile/profileAvatarConfig.js';

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

describe('profile avatar backend', () => {
  it('validateProfileAvatarUpload rejeita SVG', () => {
    assert.throws(
      () =>
        validateProfileAvatarUpload({
          buffer: Buffer.from('<svg></svg>'),
          declaredMimeType: 'image/svg+xml',
          originalFileName: 'avatar.svg',
        }),
      (error: unknown) => error instanceof ServiceError && error.code === 'AVATAR_TYPE_FORBIDDEN',
    );
  });

  it('validateProfileAvatarUpload aceita JPEG com magic bytes', () => {
    const result = validateProfileAvatarUpload({
      buffer: JPEG_HEADER,
      declaredMimeType: 'image/jpeg',
      originalFileName: 'photo.jpg',
    });
    assert.equal(result.mimeType, 'image/jpeg');
  });

  it('buildProfileAvatarVariantKey usa prefixo profiles/users', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    assertSafeProfileUserId(userId);
    const key = buildProfileAvatarVariantKey({
      userId,
      version: 2,
      size: 128,
      extension: 'webp',
    });
    assert.match(key, /^profiles\/users\//);
    assert.match(key, /avatar_128\.webp$/);
    assert.doesNotMatch(key, /@/);
  });

  it('buildProfileAvatarUrl não expõe objectKey', () => {
    const url = buildProfileAvatarUrl({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      version: 3,
      size: 128,
      self: true,
    });
    assert.equal(url.startsWith('/api/profile/avatar?'), true);
    assert.equal(url.includes('objectKey'), false);
    assert.equal(url.includes('profiles/'), false);
  });
});

describe('profile avatar frontend helpers', () => {
  it('validateProfileAvatarFile rejeita arquivo grande', async () => {
    const { validateProfileAvatarFile } = await import('../src/features/profile/utils/profileAvatarValidation.ts');
    const file = {
      type: 'image/jpeg',
      size: 6 * 1024 * 1024,
      name: 'big.jpg',
    } as File;
    assert.equal(validateProfileAvatarFile(file), 'A imagem deve ter no máximo 5 MB.');
  });

  it('buildUserAvatarUrl usa query v=', () => {
    const url = buildProfileAvatarUrl({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      version: 4,
      size: 64,
      self: true,
    });
    assert.match(url, /v=4/);
    assert.match(url, /size=64/);
  });
});
