import { mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const repoRoot = join(import.meta.dirname, '..');
const inputPath = join(repoRoot, 'favicon.png');
const outputDir = join(repoRoot, 'public');

const OUTPUTS = [
  { file: 'favicon-16.png', size: 16, palette: true },
  { file: 'favicon-32.png', size: 32, palette: true },
  { file: 'favicon-48.png', size: 48, palette: true },
  { file: 'apple-touch-icon.png', size: 180, palette: false },
] as const;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await fileExists(inputPath))) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  await mkdir(outputDir, { recursive: true });

  for (const { file, size, palette } of OUTPUTS) {
    const outputPath = join(outputDir, file);
    const info = await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png({
        compressionLevel: 9,
        effort: 10,
        palette,
      })
      .toFile(outputPath);
    console.log(`✓ ${file} (${info.width}×${info.height}, ${info.size} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
