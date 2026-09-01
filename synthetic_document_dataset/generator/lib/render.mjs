import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_BIN,
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
].filter(Boolean);

let resolvedBinary = null;

async function resolveChromium() {
  if (resolvedBinary) return resolvedBinary;
  for (const candidate of CHROMIUM_CANDIDATES) {
    try {
      await run(candidate, ['--version']);
      resolvedBinary = candidate;
      return candidate;
    } catch {
      // tenta o próximo
    }
  }
  throw new Error(
    `Nenhum Chromium encontrado. Instale um dos: ${CHROMIUM_CANDIDATES.join(', ')} ` +
      'ou aponte CHROMIUM_BIN para o binário.',
  );
}

/**
 * HTML para PDF pelo Chromium em modo headless.
 *
 * O texto sai como texto de verdade no PDF, não como imagem — é isso que faz o
 * documento passar pelo extrator de texto do app antes de qualquer OCR, que é
 * o caminho que a maioria dos arquivos reais percorre.
 */
export async function htmlToPdf(html, outputPath) {
  const binary = await resolveChromium();
  const workDir = await mkdtemp(join(tmpdir(), 'doqyn-synth-'));
  const htmlPath = join(workDir, 'page.html');

  try {
    await writeFile(htmlPath, html, 'utf8');
    await run(binary, [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=2000',
      `--print-to-pdf=${outputPath}`,
      htmlPath,
    ]);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
