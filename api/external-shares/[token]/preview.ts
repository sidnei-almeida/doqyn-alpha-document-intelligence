import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getExternalSharePreviewManifest,
  readExternalSharePreviewImageAsset,
  readExternalSharePreviewPageImage,
} from '../../../server/services/sharing/externalDocumentSharePreviewService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { setPreviewAssetCacheHeaders, setPreviewManifestCacheHeaders } from '../../../server/utils/previewCacheHeaders.js';

function resolveToken(req: VercelRequest): string | undefined {
  const fromQuery = req.query.token;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

function resolveSubresource(pathname: string, token: string): string | null {
  const prefix = `/api/external-shares/${encodeURIComponent(token)}/preview`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  return rest || '/manifest';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_SHARE_TOKEN' });
  }

  const pathname = typeof req.url === 'string' ? new URL(req.url, 'http://localhost').pathname : '';
  const subresource = resolveSubresource(pathname, token) ?? '/manifest';

  try {
    if (subresource === '/manifest' || subresource === '/') {
      const manifest = await getExternalSharePreviewManifest(token);
      setPreviewManifestCacheHeaders(res, {
        documentId: manifest.documentId,
        versionId: manifest.versionId,
        status: manifest.status,
      });
      return res.status(200).json(manifest);
    }

    const pageMatch = subresource.match(/^\/pages\/(\d+)$/);
    if (pageMatch) {
      const pageNumber = Number(pageMatch[1]);
      const file = await readExternalSharePreviewPageImage({ token, pageNumber, thumbnail: false });
      setPreviewAssetCacheHeaders(res, `"guest:${token}:page:${pageNumber}"`);
      res.setHeader('Content-Type', file.mimeType);
      return res.status(200).send(file.buffer);
    }

    const thumbMatch = subresource.match(/^\/thumbnails\/(\d+)$/);
    if (thumbMatch) {
      const pageNumber = Number(thumbMatch[1]);
      const file = await readExternalSharePreviewPageImage({ token, pageNumber, thumbnail: true });
      setPreviewAssetCacheHeaders(res, `"guest:${token}:thumb:${pageNumber}"`);
      res.setHeader('Content-Type', file.mimeType);
      return res.status(200).send(file.buffer);
    }

    if (subresource.startsWith('/image')) {
      const size = typeof req.query.size === 'string' ? req.query.size : undefined;
      const file = await readExternalSharePreviewImageAsset({ token, size });
      setPreviewAssetCacheHeaders(res, `"guest:${token}:image:${size ?? 'medium'}"`);
      res.setHeader('Content-Type', file.mimeType);
      return res.status(200).send(file.buffer);
    }

    return res.status(404).json({ message: 'Recurso de preview não encontrado.', code: 'PREVIEW_NOT_FOUND' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
