const MAX_CACHED_THUMBNAILS = 150;

type CacheEntry = {
  objectUrl: string;
  lastAccessed: number;
};

const cache = new Map<string, CacheEntry>();

export function buildDocumentThumbnailCacheKey(input: {
  tenantId: string;
  documentId: string;
  versionId: string;
  assetUrl: string;
}): string {
  return `document-thumbnail:${input.tenantId}:${input.documentId}:${input.versionId}:${input.assetUrl}`;
}

export function getCachedThumbnailUrl(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  entry.lastAccessed = Date.now();
  return entry.objectUrl;
}

function evictLeastRecentlyUsed(): void {
  if (cache.size < MAX_CACHED_THUMBNAILS) return;

  let oldestKey: string | null = null;
  let oldestAccess = Infinity;

  for (const [key, entry] of cache) {
    if (entry.lastAccessed < oldestAccess) {
      oldestAccess = entry.lastAccessed;
      oldestKey = key;
    }
  }

  if (!oldestKey) return;
  const removed = cache.get(oldestKey);
  if (removed) URL.revokeObjectURL(removed.objectUrl);
  cache.delete(oldestKey);
}

/** Cria ou reutiliza objectURL para um blob já em cache React Query. */
export function ensureThumbnailObjectUrl(key: string, blob: Blob): string {
  const existing = getCachedThumbnailUrl(key);
  if (existing) return existing;

  evictLeastRecentlyUsed();
  const objectUrl = URL.createObjectURL(blob);
  cache.set(key, { objectUrl, lastAccessed: Date.now() });
  return objectUrl;
}

export function releaseThumbnailUrl(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  URL.revokeObjectURL(entry.objectUrl);
  cache.delete(key);
}

export function clearThumbnailCacheForTenant(tenantId: string): void {
  const prefix = `document-thumbnail:${tenantId}:`;
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(entry.objectUrl);
      cache.delete(key);
    }
  }
}

export function clearAllThumbnailCache(): void {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  cache.clear();
}

/** Expõe tamanho atual — útil para testes. */
export function getThumbnailCacheSize(): number {
  return cache.size;
}

export function getThumbnailCacheMaxItems(): number {
  return MAX_CACHED_THUMBNAILS;
}
