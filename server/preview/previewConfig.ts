const DEFAULT_WATERMARK = 'DOQYN';
const DEFAULT_GS_PATH = 'gs';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PROFILE = 'ebook';
const DEFAULT_MAX_INPUT_MB = 80;
/** DPI da página completa no viewer (144 era o default legado; 180 melhora nitidez em telas Retina). */
const DEFAULT_PAGE_DPI = 180;
const DEFAULT_THUMB_DPI = 72;
const DEFAULT_IMAGE_PREVIEW_QUALITY = 90;

export type PdfPreviewConfig = {
  enabled: boolean;
  watermarkText: string;
  ghostscriptPath: string;
  timeoutMs: number;
  profile: string;
  maxInputBytes: number;
  pageDpi: number;
  thumbDpi: number;
  imagePreviewQuality: number;
};

function readBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return defaultValue;
}

function readPositiveInt(name: string, defaultValue: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
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
    pageDpi: readPositiveInt('PDF_PREVIEW_PAGE_DPI', DEFAULT_PAGE_DPI),
    thumbDpi: readPositiveInt('PDF_PREVIEW_THUMB_DPI', DEFAULT_THUMB_DPI),
    imagePreviewQuality: readPositiveInt('IMAGE_PREVIEW_QUALITY', DEFAULT_IMAGE_PREVIEW_QUALITY),
  };
}
