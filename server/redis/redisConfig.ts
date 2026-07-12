function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function isRedisEnabled(): boolean {
  return readBool(process.env.REDIS_ENABLED, Boolean(process.env.REDIS_URL?.trim()));
}

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  return url;
}

export function getRedisKeyPrefix(): string {
  return process.env.REDIS_KEY_PREFIX?.trim() || 'doqyn:';
}

export function prefixRedisKey(key: string): string {
  return `${getRedisKeyPrefix()}${key}`;
}

export function getRedisMaxRetries(): number {
  return readPositiveInt(process.env.REDIS_MAX_RETRIES, 10);
}

export function getRedisConnectTimeoutMs(): number {
  return readPositiveInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 5_000);
}
