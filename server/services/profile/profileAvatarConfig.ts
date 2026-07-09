export type ProfileAvatarConfig = {
  maxBytes: number;
  allowedMimeTypes: Set<string>;
  outputFormat: 'webp' | 'png';
  sizes: number[];
};

const DEFAULT_ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

function parseSizes(raw: string | undefined): number[] {
  const parsed = (raw ?? '64,128,256')
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 512);
  return parsed.length > 0 ? parsed : [64, 128, 256];
}

export function getProfileAvatarConfig(): ProfileAvatarConfig {
  const maxMb = Number(process.env.PROFILE_AVATAR_MAX_SIZE_MB ?? 5);
  const maxBytes =
    Number.isFinite(maxMb) && maxMb > 0 ? maxMb * 1024 * 1024 : 5 * 1024 * 1024;

  const allowedRaw =
    process.env.PROFILE_AVATAR_ALLOWED_TYPES?.trim() || DEFAULT_ALLOWED.join(',');
  const allowedMimeTypes = new Set(
    allowedRaw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  const outputRaw = (process.env.PROFILE_AVATAR_OUTPUT_FORMAT ?? 'webp').trim().toLowerCase();
  const outputFormat = outputRaw === 'png' ? 'png' : 'webp';

  return {
    maxBytes,
    allowedMimeTypes,
    outputFormat,
    sizes: parseSizes(process.env.PROFILE_AVATAR_SIZES),
  };
}

export function buildProfileAvatarUrl(input: {
  userId: string;
  version: number;
  size?: number;
  self?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('v', String(input.version));
  if (input.size) params.set('size', String(input.size));
  const base = input.self ? '/api/profile/avatar' : `/api/users/${encodeURIComponent(input.userId)}/avatar`;
  return `${base}?${params.toString()}`;
}
