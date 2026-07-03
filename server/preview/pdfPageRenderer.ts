import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getPdfPreviewConfig } from './previewConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';

const execFileAsync = promisify(execFile);

export type RenderPdfPageInput = {
  pdfBuffer: Buffer;
  pageNumber: number;
  dpi?: number;
  ghostscriptPath?: string;
  timeoutMs?: number;
};

export type RenderPdfPageResult = {
  buffer: Buffer;
  mimeType: 'image/png';
};

export async function renderPdfPageToPng(input: RenderPdfPageInput): Promise<RenderPdfPageResult> {
  const config = getPdfPreviewConfig();
  const gsPath = input.ghostscriptPath?.trim() || config.ghostscriptPath || 'gs';
  const dpi = input.dpi ?? 144;
  const timeoutMs = input.timeoutMs ?? config.timeoutMs;
  const pageNumber = Math.max(1, Math.floor(input.pageNumber));

  const tempDir = await mkdtemp(path.join(tmpdir(), 'doqyn-page-'));
  const inputPath = path.join(tempDir, 'preview.pdf');
  const outputPath = path.join(tempDir, `page-${pageNumber}.png`);

  try {
    await writeFile(inputPath, input.pdfBuffer);

    const args = [
      '-sDEVICE=png16m',
      `-r${dpi}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-dFirstPage=${pageNumber}`,
      `-dLastPage=${pageNumber}`,
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    try {
      await execFileAsync(gsPath, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        throw new ServiceError(
          'Ghostscript não está disponível para renderizar páginas.',
          'GHOSTSCRIPT_NOT_AVAILABLE',
          503,
        );
      }
      throw new ServiceError('Falha ao renderizar página do preview.', 'PREVIEW_PAGE_RENDER_FAILED', 500);
    }

    const buffer = await readFile(outputPath);
    if (!buffer.length) {
      throw new ServiceError('Página de preview vazia.', 'PREVIEW_PAGE_RENDER_FAILED', 500);
    }

    return { buffer, mimeType: 'image/png' };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
