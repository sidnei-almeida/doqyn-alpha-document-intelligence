import type { VercelResponse } from '@vercel/node';

function setVaryAuth(res: VercelResponse): void {
  res.setHeader('Vary', 'Cookie, Authorization');
}

/** Manifest JSON — cache curto enquanto processing; 1h quando ready/failed. */
export function setPreviewManifestCacheHeaders(
  res: VercelResponse,
  input: { documentId: string; versionId: string; status: string },
): void {
  const etag = `"${input.documentId}:${input.versionId}:${input.status}"`;
  res.setHeader('ETag', etag);
  setVaryAuth(res);
  if (input.status === 'processing') {
    res.setHeader('Cache-Control', 'private, no-store');
    return;
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
}

/** Thumbnails/imagens de versão imutável — cache privado longo. */
export function setPreviewAssetCacheHeaders(
  res: VercelResponse,
  etag: string,
  options?: { immutable?: boolean },
): void {
  res.setHeader('ETag', etag);
  setVaryAuth(res);
  if (options?.immutable === false) {
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return;
  }
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
}
