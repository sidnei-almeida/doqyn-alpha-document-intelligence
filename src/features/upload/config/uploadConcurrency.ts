/**
 * Quantos arquivos o navegador mantém em análise ao mesmo tempo.
 *
 * A fila enviava estritamente um por vez: enviava, esperava a análise inteira, confirmava, e só
 * então começava o próximo. Para 20 arquivos são 20 × (envio + análise + confirmação) em série,
 * com o servidor ocioso boa parte do tempo — a espera é da Groq, não do navegador.
 *
 * O teto é baixo de propósito. Quem limita a vazão de verdade é o limitador da conta Groq no
 * servidor; abrir demais aqui só troca fila do lado do servidor por conexão parada no cliente, e
 * ainda multiplica o pico de memória do upload.
 */
const DEFAULT_ANALYSIS_CONCURRENCY = 3;
const MAX_ANALYSIS_CONCURRENCY = 5;

/** Interpreta o valor bruto da configuração (testável sem import.meta). */
export function parseUploadAnalysisConcurrency(envValue: string | undefined | null): number {
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_ANALYSIS_CONCURRENCY;
  return Math.min(Math.floor(parsed), MAX_ANALYSIS_CONCURRENCY);
}

/**
 * Ajuste por ambiente:
 *   VITE_UPLOAD_ANALYSIS_CONCURRENCY=2
 *
 * `1` restaura o comportamento antigo, um arquivo por vez.
 */
export function getUploadAnalysisConcurrency(): number {
  return parseUploadAnalysisConcurrency(import.meta.env.VITE_UPLOAD_ANALYSIS_CONCURRENCY);
}
