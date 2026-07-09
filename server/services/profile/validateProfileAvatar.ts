import { ServiceError } from '../../utils/serviceErrors.js';
import { getProfileAvatarConfig } from './profileAvatarConfig.js';

const MAGIC = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46],
} as const;

function startsWithMagic(buffer: Buffer, magic: readonly number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, index) => buffer[index] === byte);
}

function detectImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (startsWithMagic(buffer, MAGIC.jpeg)) return 'image/jpeg';
  if (startsWithMagic(buffer, MAGIC.png)) return 'image/png';
  if (
    startsWithMagic(buffer, MAGIC.webp) &&
    buffer.length >= 12 &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateProfileAvatarUpload(input: {
  buffer: Buffer;
  declaredMimeType: string;
  originalFileName?: string;
}): { mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const config = getProfileAvatarConfig();

  if (input.buffer.length > config.maxBytes) {
    throw new ServiceError(
      `A imagem excede o limite de ${Math.floor(config.maxBytes / (1024 * 1024))} MB.`,
      'AVATAR_TOO_LARGE',
      413,
    );
  }

  if (!input.buffer.length) {
    throw new ServiceError('Arquivo de avatar vazio.', 'AVATAR_EMPTY', 400);
  }

  const lowerName = input.originalFileName?.trim().toLowerCase() ?? '';
  if (lowerName.endsWith('.svg') || lowerName.endsWith('.gif')) {
    throw new ServiceError('Tipo de imagem não permitido para avatar.', 'AVATAR_TYPE_FORBIDDEN', 415);
  }

  const declared = input.declaredMimeType.trim().toLowerCase();
  if (declared === 'image/svg+xml' || declared === 'image/gif') {
    throw new ServiceError('Tipo de imagem não permitido para avatar.', 'AVATAR_TYPE_FORBIDDEN', 415);
  }

  const detected = detectImageMime(input.buffer);
  if (!detected) {
    throw new ServiceError('Arquivo não é uma imagem válida.', 'AVATAR_INVALID_IMAGE', 415);
  }

  if (!config.allowedMimeTypes.has(detected)) {
    throw new ServiceError('Tipo de imagem não permitido.', 'AVATAR_UNSUPPORTED_TYPE', 415);
  }

  if (declared && declared !== detected && !config.allowedMimeTypes.has(declared)) {
    throw new ServiceError('Tipo declarado não corresponde ao conteúdo.', 'AVATAR_MIME_MISMATCH', 415);
  }

  return { mimeType: detected };
}
