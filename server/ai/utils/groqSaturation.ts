/**
 * Saturação da vazão da Groq — o caso em que esperar resolve.
 *
 * `GROQ_RATE_LIMIT` é o 429 da própria Groq e também o teto de espera do limitador local
 * (`GroqRateLimitWaitTimeout`, código `GROQ_LOCAL_RATE_LIMIT`) — nos dois a conta está com a janela
 * cheia e a vaga aparece sozinha em algum momento. Ficam de fora `GROQ_DAILY_TOKEN_LIMIT` (a cota
 * do dia acabou, esperar minutos não devolve) e `GROQ_CONTEXT_LIMIT` (prompt grande demais, esperar
 * nunca resolve).
 */
const SATURATION_CODES = new Set(['GROQ_RATE_LIMIT', 'GROQ_LOCAL_RATE_LIMIT']);

export function isGroqSaturationCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && SATURATION_CODES.has(code);
}

/**
 * O código é lido por forma, não por instância: `AiAnalysisError` e `GroqRateLimitWaitTimeout` são
 * classes diferentes em módulos diferentes, e importar as duas aqui arrastaria o cliente Groq e o
 * Redis para dentro do worker só para um `instanceof`.
 */
export function isGroqSaturationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && isGroqSaturationCode(code);
}
