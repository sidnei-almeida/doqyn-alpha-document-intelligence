const DEFAULT_WATERMARK = 'DOQYN';
const DEFAULT_GS_PATH = 'gs';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PROFILE = 'ebook';
const DEFAULT_MAX_INPUT_MB = 80;

export type PdfPreviewConfig = {
  enabled: boolean;
  watermarkText: string;
  ghostscriptPath: string;
  timeoutMs: number;
  profile: string;
  maxInputBytes: number;
};

function readBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return defaultValue;
}

export function getPdfPreviewConfig(): PdfPreviewConfig {
  const maxInputMb = Number(process.env.PDF_PREVIEW_MAX_INPUT_MB ?? DEFAULT_MAX_INPUT_MB);
  const maxInputBytes =
    Number.isFinite(maxInputMb) && maxInputMb > 0
      ? maxInputMb * 1024 * 1024
      : DEFAULT_MAX_INPUT_MB * 1024 * 1024;

  return {
    enabled: readBoolean('PDF_PREVIEW_ENABLED', true),
    watermarkText: process.env.PDF_PREVIEW_WATERMARK_TEXT?.trim() || DEFAULT_WATERMARK,
    ghostscriptPath: process.env.PDF_PREVIEW_GHOSTSCRIPT_PATH?.trim() || DEFAULT_GS_PATH,
    timeoutMs: Number(process.env.PDF_PREVIEW_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    profile: process.env.PDF_PREVIEW_PROFILE?.trim() || DEFAULT_PROFILE,
    maxInputBytes,
  };
}
