import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ServiceError } from '../utils/serviceErrors.js';

const execFileAsync = promisify(execFile);

export type GhostscriptOptimizerDeps = {
  execFileFn?: typeof execFileAsync;
};

export type OptimizePdfInput = {
  inputBuffer: Buffer;
  ghostscriptPath?: string;
  timeoutMs?: number;
  profile?: string;
};

function pdfSettingsFlag(profile: string): string {
  const normalized = profile.trim().toLowerCase();
  if (normalized === 'screen' || normalized === 'ebook' || normalized === 'printer' || normalized === 'prepress') {
    return `-dPDFSETTINGS=/${normalized}`;
  }
  return '-dPDFSETTINGS=/ebook';
}

export async function optimizePdfWithGhostscript(
  input: OptimizePdfInput,
  deps: GhostscriptOptimizerDeps = {},
): Promise<Buffer> {
  const execFn = deps.execFileFn ?? execFileAsync;
  const gsPath = input.ghostscriptPath?.trim() || 'gs';
  const timeoutMs = input.timeoutMs ?? 60_000;
  const profileFlag = pdfSettingsFlag(input.profile ?? 'ebook');

  const tempDir = await mkdtemp(path.join(tmpdir(), 'doqyn-gs-'));
  const inputPath = path.join(tempDir, 'input.pdf');
  const outputPath = path.join(tempDir, 'output.pdf');

  try {
    await writeFile(inputPath, input.inputBuffer);

    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      profileFlag,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    try {
      await execFn(gsPath, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        throw new ServiceError(
          'Ghostscript não está disponível no servidor.',
          'GHOSTSCRIPT_NOT_AVAILABLE',
          503,
        );
      }
      throw new ServiceError(
        'Falha ao otimizar preview PDF.',
        'GHOSTSCRIPT_OPTIMIZATION_FAILED',
        500,
      );
    }

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
