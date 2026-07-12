import { isR2StorageConfigured } from './storageConfig.js';

const DEFAULT_TTL_SECONDS = 900;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3_600;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** Upload direto browser → R2 (Fase B.5). Requer storage R2 configurado. */
export function isPresignedUploadEnabled(): boolean {
  if (!isR2StorageConfigured()) return false;
  const raw = process.env.PRESIGNED_UPLOAD_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return true;
}

export function getPresignedUploadTtlSeconds(): number {
  const raw = readPositiveInt(process.env.PRESIGNED_UPLOAD_TTL_SECONDS, DEFAULT_TTL_SECONDS);
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, raw));
}
