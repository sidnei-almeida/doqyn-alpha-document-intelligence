/**
 * Rasteriza os cartões de link (Open Graph) para PNG.
 *
 * PNG e não WebP: o WhatsApp não renderiza WebP em preview de link, e era por isso que o
 * cartão nunca aparecia no chat mesmo com as meta tags corretas. Facebook e Twitter têm o
 * mesmo limite.
 *
 * O SVG de origem é gerado por build-og-cards.py, que converte o texto em contorno.
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'og');

const files = (await readdir(OUT_DIR)).filter((name) => name.endsWith('.svg'));
if (files.length === 0) {
  console.error('Nenhum .svg em public/og — rode antes: python3 scripts/og/build-og-cards.py');
  process.exit(1);
}

for (const file of files) {
  const target = file.replace(/\.svg$/, '.png');
  const info = await sharp(join(OUT_DIR, file), { density: 144 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, target));
  console.log(`${target}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`);
}
