import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const WATERMARK_SVG_PATH = join(ASSET_DIR, 'doqyn-watermark.svg');

/** Tom cinza neutro da marca d'água (legível em fundo claro, discreto em fundo escuro). */
export const DOQYN_WATERMARK_GRAY = { r: 128, g: 128, b: 128 };

/** Proporção do lockup horizontal oficial (selo + DOQYN). */
export const DOQYN_HORIZONTAL_LOGO_ASPECT = 240 / 80;

let watermarkSvg: Buffer | null = null;

function getWatermarkSvg(): Buffer {
  if (!watermarkSvg) {
    watermarkSvg = readFileSync(WATERMARK_SVG_PATH);
  }
  return watermarkSvg;
}

/**
 * Rasteriza o selo DOQYN para a camada de marca d'água.
 *
 * Era um `.webp` da marca antiga — o ícone genérico de documento que o rebrand abandonou — e a cor
 * precisava ser recalculada pixel a pixel, atenuando o alfa pela luminância para uniformizar o
 * cinza. Esse passo era metade de uma atenuação dupla: ele derrubava o alfa, e a composição
 * derrubava de novo, deixando a marca quase invisível.
 *
 * Com o SVG a cor já nasce fixa, então não há o que recalcular. A opacidade passa a ter um dono
 * só: `DEFAULT_WATERMARK_OPACITY`, no ponto de composição.
 */
export async function rasterizeDoqynWatermarkLogo(targetWidth: number): Promise<Buffer> {
  const width = Math.max(160, Math.min(2800, Math.round(targetWidth)));

  return sharp(getWatermarkSvg(), { density: 300 })
    .resize(width, null, { fit: 'inside' })
    .ensureAlpha()
    .png()
    .toBuffer();
}
