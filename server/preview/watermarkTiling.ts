import sharp from 'sharp';
import {
  DOQYN_HORIZONTAL_LOGO_ASPECT,
  rasterizeDoqynWatermarkLogo,
} from './watermarkAsset.js';

export const DEFAULT_WATERMARK_OPACITY = 0.3;
export const DEFAULT_WATERMARK_ROTATION_DEG = -32;

export type WatermarkTilePosition = {
  x: number;
  y: number;
};

export type WatermarkTileLayout = {
  tileWidth: number;
  tileHeight: number;
  positions: WatermarkTilePosition[];
};

export function computeWatermarkTileLayout(width: number, height: number): WatermarkTileLayout {
  const tileHeight = Math.min(width, height) * 0.085;
  const tileWidth = tileHeight * DOQYN_HORIZONTAL_LOGO_ASPECT;
  const stepX = width * 0.28;
  const stepY = height * 0.2;
  const positions: WatermarkTilePosition[] = [];

  for (let y = -height * 0.15; y < height * 1.15; y += stepY) {
    for (let x = -width * 0.15; x < width * 1.15; x += stepX) {
      positions.push({ x, y });
    }
  }

  return { tileWidth, tileHeight, positions };
}

async function buildRotatedWatermarkTile(
  tileWidth: number,
  tileHeight: number,
  opacity: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const rasterWidth = Math.max(320, Math.round(tileWidth * 2.5));
  const logo = await rasterizeDoqynWatermarkLogo(rasterWidth);
  const rotated = await sharp(logo)
    .resize(Math.round(tileWidth), Math.round(tileHeight), { fit: 'inside' })
    .rotate(DEFAULT_WATERMARK_ROTATION_DEG, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = rotated;
  const alphaScale = Math.max(0.05, Math.min(1, opacity));
  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.round(data[index] * alphaScale);
  }

  const buffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return { buffer, width: info.width, height: info.height };
}

/** Gera camada PNG transparente com a logo horizontal DOQYN repetida em diagonal. */
export async function buildDoqynLogoWatermarkOverlay(
  width: number,
  height: number,
  opacity = DEFAULT_WATERMARK_OPACITY,
): Promise<Buffer> {
  const { tileWidth, tileHeight, positions } = computeWatermarkTileLayout(width, height);
  const tile = await buildRotatedWatermarkTile(tileWidth, tileHeight, opacity);

  const composites = positions.map((position) => ({
    input: tile.buffer,
    top: Math.round(position.y - tile.height / 2),
    left: Math.round(position.x - tile.width / 2),
    blend: 'over' as const,
  }));

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
