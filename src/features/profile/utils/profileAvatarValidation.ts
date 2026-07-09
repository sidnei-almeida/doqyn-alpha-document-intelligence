export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function validateProfileAvatarFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!PROFILE_AVATAR_ALLOWED_TYPES.has(file.type)) {
    return 'Use JPG, PNG ou WebP.';
  }
  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return 'A imagem deve ter no máximo 5 MB.';
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.svg') || lower.endsWith('.gif')) {
    return 'SVG e GIF não são permitidos.';
  }
  return null;
}
