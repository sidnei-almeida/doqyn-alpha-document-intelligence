import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Gera os PNG de favicon a partir de `public/favicon.svg`, que é a fonte única
 * da marca na aba.
 *
 * O SVG acompanha o tema do navegador por `prefers-color-scheme`; PNG não sabe
 * fazer isso, então os fallbacks saem num teal intermediário entre os dois tons
 * do app — passa de 4:1 contra papel e contra grafite. Fundo transparente: a
 * aba tem cor própria, e o quadrado branco de antes brigava com ela.
 *
 * O ícone da Apple é a exceção: o iOS achata transparência contra preto, então
 * ele sai opaco sobre o grafite da base, e aí cabe o anel interno do selo.
 */

const repoRoot = join(import.meta.dirname, '..');
const outputDir = join(repoRoot, 'public');
const svgPath = join(outputDir, 'favicon.svg');

const PNG_TEAL = '#1f8a84';
const APPLE_BG = '#12161a';
const APPLE_TEAL = '#35a69f';

/** Mesma geometria do `favicon.svg` e de `src/components/brand/DoqynMark.tsx`. */
function mark(stroke: string, withPress: boolean): string {
  return `
    <g fill="none" stroke="${stroke}" stroke-linecap="round">
      <circle cx="15.3" cy="15.3" r="11.6" stroke-width="3.4"/>
      ${withPress ? '<circle cx="15.3" cy="15.3" r="7.7" stroke-width="1.3" opacity="0.5"/>' : ''}
      <path d="M18.1 18.1 L27.8 27.8" stroke-width="4.4"/>
    </g>`;
}

const flatSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${mark(PNG_TEAL, false)}</svg>`;

const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="${APPLE_BG}"/>
  <g transform="translate(35,35) scale(3.44)">${mark(APPLE_TEAL, true)}</g>
</svg>`;

async function main() {
  // Não usamos o conteúdo, mas a ausência do SVG significa que a fonte da marca
  // sumiu — melhor falhar aqui do que gerar PNG de uma geometria órfã.
  await readFile(svgPath, 'utf8');
  await mkdir(outputDir, { recursive: true });

  for (const size of [16, 32, 48] as const) {
    const info = await sharp(Buffer.from(flatSvg), { density: 384 })
      .resize(size, size)
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(join(outputDir, `favicon-${size}.png`));
    console.log(`✓ favicon-${size}.png (${info.width}×${info.height}, ${info.size} bytes)`);
  }

  const apple = await sharp(Buffer.from(appleSvg))
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(join(outputDir, 'apple-touch-icon.png'));
  console.log(`✓ apple-touch-icon.png (${apple.width}×${apple.height}, ${apple.size} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
