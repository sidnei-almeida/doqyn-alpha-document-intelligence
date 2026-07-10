import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const HORIZONTAL_LOGO_PATH = join(ASSET_DIR, 'doqyn-horizontal.webp');

/** Tom cinza neutro da marca d'água (legível em fundo claro, discreto em fundo escuro). */
export const DOQYN_WATERMARK_GRAY = { r: 128, g: 128, b: 128 };

/** Proporção do lockup horizontal oficial (ícone + DOQYN). */
export const DOQYN_HORIZONTAL_LOGO_ASPECT = 960 / 320;

let horizontalLogoBuffer: Buffer | null = null;

function getHorizontalLogoBuffer(): Buffer {
  if (!horizontalLogoBuffer) {
    horizontalLogoBuffer = readFileSync(HORIZONTAL_LOGO_PATH);
  }
  return horizontalLogoBuffer;
}

/** Rasteriza a logo horizontal DOQYN em cinza uniforme (fundo transparente) para previews. */
export async function rasterizeDoqynWatermarkLogo(targetWidth: number): Promise<Buffer> {
  const width = Math.max(160, Math.min(2800, Math.round(targetWidth)));
  const height = Math.max(48, Math.round(width / DOQYN_HORIZONTAL_LOGO_ASPECT));

  const { data, info } = await sharp(getHorizontalLogoBuffer())
    .resize(width, height, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { r, g, b } = DOQYN_WATERMARK_GRAY;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 4) {
      data[index + 3] = 0;
      continue;
    }

    const luminance = Math.round(
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114,
    );
    const shapeAlpha = Math.round((alpha / 255) * (luminance / 255) * 255);
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = shapeAlpha > 0 ? Math.max(shapeAlpha, Math.round(alpha * 0.9)) : 0;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}
