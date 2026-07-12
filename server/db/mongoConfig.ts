import type { MongoClientOptions } from 'mongodb';

const DEFAULT_POOL_MAX = 50;
const DEFAULT_POOL_MIN = 5;
const DEFAULT_SERVER_SELECTION_MS = 5_000;
const ATLAS_SERVER_SELECTION_MS = 10_000;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/** URI Atlas (SRV) ou flag explícita MONGODB_USE_ATLAS. */
export function isMongoAtlasUri(uri: string): boolean {
  return uri.trim().toLowerCase().startsWith('mongodb+srv://');
}

export function isMongoAtlasEnabled(): boolean {
  const flag = process.env.MONGODB_USE_ATLAS?.trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;

  const uri = process.env.MONGODB_URI?.trim() ?? '';
  return uri.length > 0 && isMongoAtlasUri(uri);
}

export function getMongoServerSelectionTimeoutMs(): number {
  const fromEnv = readPositiveInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 0);
  if (fromEnv > 0) return fromEnv;
  return isMongoAtlasEnabled() ? ATLAS_SERVER_SELECTION_MS : DEFAULT_SERVER_SELECTION_MS;
}

export function getMongoClientOptions(): MongoClientOptions {
  return {
    maxPoolSize: readPositiveInt(process.env.MONGODB_MAX_POOL_SIZE, DEFAULT_POOL_MAX),
    minPoolSize: readPositiveInt(process.env.MONGODB_MIN_POOL_SIZE, DEFAULT_POOL_MIN),
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: getMongoServerSelectionTimeoutMs(),
    retryWrites: true,
  };
}

export function getMongoConnectionLabel(): string {
  return isMongoAtlasEnabled() ? 'MongoDB Atlas' : 'MongoDB';
}
