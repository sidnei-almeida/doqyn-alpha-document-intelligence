/**
 * Orçamento de tokens do refino de um documento.
 *
 * Governa o que o laço gasta ADICIONALMENTE — avaliação e re-extrações. A classificação e a
 * extração inicial acontecem antes e não debitam daqui: são o custo obrigatório de qualquer
 * documento, e cortá-las não é decisão que este orçamento tenha como tomar.
 *
 * O laço de refino pode, em princípio, insistir para sempre: avalia, não gostou, busca de novo,
 * avalia de novo. O que impede isso não é o dinheiro — a diferença entre os modelos gpt-oss é
 * inferior a um dólar por mil documentos no nosso volume (ver `aiConfig.ts`) — é a vazão. A conta
 * entrega tokens por minuto, e um documento teimoso consome a janela inteira sozinho enquanto o
 * resto da fila espera.
 *
 * Por isso o freio é contado em token e vive por job, sem estado global: dois documentos analisados
 * em paralelo têm orçamentos independentes, e o limitador de vazão (`groqRateLimiter`) continua
 * sendo quem arbitra entre eles.
 */

export type TokenBudget = {
  /** Debita o gasto já ocorrido. Aceita passar do teto: o estouro precisa ficar visível. */
  spend(tokens: number): void;
  /** Quanto ainda cabe. Nunca negativo. */
  remaining(): number;
  /** Total já gasto, inclusive o que passou do teto. */
  spent(): number;
  limit(): number;
  /** Se uma chamada estimada em `estimatedTokens` ainda cabe. */
  canAfford(estimatedTokens: number): boolean;
  /** Se o teto já foi alcançado ou ultrapassado. */
  isExhausted(): boolean;
};

export function createTokenBudget(limitTokens: number): TokenBudget {
  const limit = Math.max(0, Math.floor(limitTokens));
  let used = 0;

  return {
    spend(tokens: number): void {
      if (!Number.isFinite(tokens) || tokens <= 0) return;
      used += tokens;
    },
    remaining(): number {
      return Math.max(0, limit - used);
    },
    spent(): number {
      return used;
    },
    limit(): number {
      return limit;
    },
    canAfford(estimatedTokens: number): boolean {
      const estimate = Number.isFinite(estimatedTokens) ? Math.max(0, estimatedTokens) : 0;
      return used + estimate <= limit;
    },
    isExhausted(): boolean {
      return used >= limit;
    },
  };
}

/**
 * Orçamento que nunca acaba, para os caminhos que ainda não são refinados — a análise antiga, os
 * testes que não estão medindo custo. Evita espalhar `budget?: TokenBudget` e um `if` em cada uso.
 */
export function createUnlimitedTokenBudget(): TokenBudget {
  return createTokenBudget(Number.MAX_SAFE_INTEGER);
}
