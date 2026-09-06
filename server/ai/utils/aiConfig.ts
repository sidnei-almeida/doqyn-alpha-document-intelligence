/**
 * `llama-3.1-8b-instant` foi descontinuado pela Groq em 17/06/2026 para as contas free e
 * developer. O gpt-oss-120b é o substituto: modelo de produção, 131k de contexto, e a
 * diferença de custo para a alternativa mais barata (gpt-oss-20b) é inferior a um dólar por
 * mil documentos no nosso volume de entrada — barato demais para justificar errar metadado.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
/**
 * Orçamento de saída, e ele **inclui o raciocínio**.
 *
 * Os `gpt-oss` são modelos de raciocínio: gastam tokens de saída pensando antes de responder, e o
 * teto cobre os dois. O valor antigo (1200) foi dimensionado para os Llama, que não raciocinam —
 * com o gpt-oss, o pensamento comia o orçamento e a extração voltava com `finish_reason: length`,
 * o JSON cortado no meio e metade dos campos faltando. Parecia modelo ruim; era resposta truncada.
 */
export const DEFAULT_GROQ_MAX_OUTPUT_TOKENS = 4000;
export const DEFAULT_GROQ_REQUEST_TIMEOUT_MS = 25_000;
/**
 * Dimensionados para a janela de 131k tokens do llama-4-scout (~460k chars).
 * Documento empresarial de ~100 páginas cabe no contexto; o teto antigo
 * (10 páginas / 30k chars) era o rate limit do plano gratuito da Groq
 * (6k TPM), não um limite do modelo. Em dev no plano gratuito, mantenha os
 * valores baixos via .env ou a análise devolve 429.
 */
export const DEFAULT_PDF_ANALYSIS_MAX_INPUT_CHARS = 300_000;
export const DEFAULT_PDF_ANALYSIS_MAX_PAGES = 100;
/** Chunks enviados ao extrator. Antes fixo em 8 (~14k chars), o que descartava
 * quase todo documento longo mesmo com o texto já extraído. */
export const DEFAULT_EXTRACTION_MAX_CHUNKS = 40;
/**
 * Teto de tokens por documento, somando classificação, extração, avaliação e re-extrações.
 *
 * Medido em 01/09/2026: um documento gasta ~4.000 tokens no caminho reto (1,3k de classificação,
 * 2,2k de extração, mais a saída). O teto de 15.000 dá espaço a dois passes focados e duas
 * chamadas de avaliação, e ainda deixa margem — mas impede que um único documento consuma quase
 * dois minutos inteiros da vazão da conta (8.000 tokens/min medidos na mesma data).
 */
export const DEFAULT_EXTRACTION_TOKEN_BUDGET = 15_000;
/** Quantas vezes o laço pode voltar ao documento depois da extração inicial. */
export const DEFAULT_EXTRACTION_REFINEMENT_MAX_PASSES = 2;

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
  return readPositiveInt(
    process.env.PDF_ANALYSIS_MAX_INPUT_CHARS,
    DEFAULT_PDF_ANALYSIS_MAX_INPUT_CHARS,
  );
}

export function getPdfAnalysisMaxPages(): number {
  return readPositiveInt(process.env.PDF_ANALYSIS_MAX_PAGES, DEFAULT_PDF_ANALYSIS_MAX_PAGES);
}

export function getExtractionMaxChunks(): number {
  return readPositiveInt(process.env.EXTRACTION_MAX_CHUNKS, DEFAULT_EXTRACTION_MAX_CHUNKS);
}

export function getExtractionTokenBudget(): number {
  return readPositiveInt(
    process.env.EXTRACTION_TOKEN_BUDGET_PER_DOCUMENT,
    DEFAULT_EXTRACTION_TOKEN_BUDGET,
  );
}

export function getExtractionRefinementMaxPasses(): number {
  return readPositiveInt(
    process.env.EXTRACTION_REFINEMENT_MAX_PASSES,
    DEFAULT_EXTRACTION_REFINEMENT_MAX_PASSES,
  );
}

/**
 * O refino nasce desligado. Ele muda o resultado da análise de todo documento, e a decisão de
 * ligá-lo depende da bancada do conjunto difícil, não de estar implementado.
 */
export function isExtractionRefinementEnabled(): boolean {
  return process.env.EXTRACTION_REFINEMENT_ENABLED?.trim().toLowerCase() === 'true';
}

export function getGroqRequestTimeoutMs(): number {
  const parsed = readPositiveInt(
    process.env.GROQ_REQUEST_TIMEOUT_MS,
    DEFAULT_GROQ_REQUEST_TIMEOUT_MS,
  );
  return Math.min(45_000, Math.max(10_000, parsed));
}
