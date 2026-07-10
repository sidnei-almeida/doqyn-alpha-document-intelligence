export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
export const DEFAULT_GROQ_MAX_OUTPUT_TOKENS = 1200;
export const DEFAULT_GROQ_REQUEST_TIMEOUT_MS = 25_000;
export const DEFAULT_PDF_ANALYSIS_MAX_INPUT_CHARS = 30_000;
export const DEFAULT_PDF_ANALYSIS_MAX_PAGES = 10;

function readPositiveInt(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

export function getGroqModelFromEnv(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function getGroqMaxOutputTokens(): number {
  return readPositiveInt(process.env.GROQ_MAX_OUTPUT_TOKENS, DEFAULT_GROQ_MAX_OUTPUT_TOKENS);
}

export function getPdfAnalysisMaxInputChars(): number {
  return readPositiveInt(process.env.PDF_ANALYSIS_MAX_INPUT_CHARS, DEFAULT_PDF_ANALYSIS_MAX_INPUT_CHARS);
}

export function getPdfAnalysisMaxPages(): number {
  return readPositiveInt(process.env.PDF_ANALYSIS_MAX_PAGES, DEFAULT_PDF_ANALYSIS_MAX_PAGES);
}

export function getGroqRequestTimeoutMs(): number {
  const parsed = readPositiveInt(
    process.env.GROQ_REQUEST_TIMEOUT_MS,
    DEFAULT_GROQ_REQUEST_TIMEOUT_MS,
  );
  return Math.min(45_000, Math.max(10_000, parsed));
}
