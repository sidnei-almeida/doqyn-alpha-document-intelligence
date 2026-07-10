import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readExternalSharePreviewImageAsset, readExternalSharePreviewPageImage } from '../services/sharing/externalDocumentSharePreviewService.js';
import {
  readSignaturePreviewImageAsset,
  readSignaturePreviewPageImage,
} from '../services/signatures/documentSignaturePreviewService.js';
import { isServiceError } from '../utils/serviceErrors.js';
import { toAbsolutePublicUrl } from '../utils/publicAppUrl.js';

type OgImageResult = {
  buffer: Buffer;
  mimeType: string;
  cacheTag: string;
};

const DEFAULT_IMAGE_RELATIVE_PATH = 'public/og/portal-default.webp';

async function readDefaultOgImage(): Promise<OgImageResult> {
  const filePath = join(process.cwd(), DEFAULT_IMAGE_RELATIVE_PATH);
  const buffer = await readFile(filePath);
  return {
    buffer,
    mimeType: 'image/webp',
    cacheTag: '"og-default"',
  };
}

async function tryReadSharePreview(token: string): Promise<OgImageResult | null> {
  try {
    const image = await readExternalSharePreviewImageAsset({ token, size: 'medium' });
    return {
      buffer: image.buffer,
      mimeType: image.mimeType,
      cacheTag: `"og-share-image:${token}"`,
    };
  } catch (error) {
    if (isServiceError(error) && error.code !== 'PREVIEW_NOT_READY') {
      // fall through to page thumbnail
    }
  }

  try {
    const thumb = await readExternalSharePreviewPageImage({ token, pageNumber: 1, thumbnail: true });
    return {
      buffer: thumb.buffer,
      mimeType: thumb.mimeType,
      cacheTag: `"og-share-thumb:${token}"`,
    };
  } catch {
    return null;
  }
}

async function tryReadSignPreview(token: string): Promise<OgImageResult | null> {
  try {
    const image = await readSignaturePreviewImageAsset({ token, size: 'medium' });
    return {
      buffer: image.buffer,
      mimeType: image.mimeType,
      cacheTag: `"og-sign-image:${token}"`,
    };
  } catch {
    // fall through
  }

  try {
    const thumb = await readSignaturePreviewPageImage({ token, pageNumber: 1, thumbnail: true });
    return {
      buffer: thumb.buffer,
      mimeType: thumb.mimeType,
      cacheTag: `"og-sign-thumb:${token}"`,
    };
  } catch {
    return null;
  }
}

export async function resolveShareOgImage(token: string): Promise<OgImageResult> {
  const preview = await tryReadSharePreview(token);
  return preview ?? readDefaultOgImage();
}

export async function resolveSignOgImage(token: string): Promise<OgImageResult> {
  const preview = await tryReadSignPreview(token);
  return preview ?? readDefaultOgImage();
}

export function resolveDefaultOgImageUrl(origin: string): string {
  return toAbsolutePublicUrl(origin, '/og/portal-default.webp');
}
