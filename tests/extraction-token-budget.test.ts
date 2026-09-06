import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTokenBudget,
  createUnlimitedTokenBudget,
} from '../server/ai/utils/tokenBudget.js';
import {
  DEFAULT_EXTRACTION_REFINEMENT_MAX_PASSES,
  DEFAULT_EXTRACTION_TOKEN_BUDGET,
  getExtractionRefinementMaxPasses,
  getExtractionTokenBudget,
  isExtractionRefinementEnabled,
} from '../server/ai/utils/aiConfig.js';
import { addTokenUsage, EMPTY_TOKEN_USAGE } from '../server/ai/services/groqClient.js';

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('orçamento de tokens', () => {
  it('debita e desconta do que resta', () => {
    const budget = createTokenBudget(1000);
    assert.equal(budget.remaining(), 1000);
    budget.spend(300);
    assert.equal(budget.spent(), 300);
    assert.equal(budget.remaining(), 700);
  });

  it('recusa a chamada que não cabe, mesmo com sobra menor', () => {
    const budget = createTokenBudget(1000);
    budget.spend(800);
    assert.equal(budget.canAfford(200), true);
    assert.equal(budget.canAfford(201), false);
  });

  it('registra o estouro em vez de escondê-lo', () => {
    // A chamada já aconteceu quando o gasto chega aqui: truncar o valor faria o log mentir
    // sobre o consumo real do documento.
    const budget = createTokenBudget(100);
    budget.spend(250);
    assert.equal(budget.spent(), 250);
    assert.equal(budget.remaining(), 0);
    assert.equal(budget.isExhausted(), true);
  });

  it('ignora gasto inválido em vez de contaminar a conta', () => {
    const budget = createTokenBudget(100);
    budget.spend(Number.NaN);
    budget.spend(-50);
    assert.equal(budget.spent(), 0);
  });

  it('o orçamento ilimitado nunca esgota', () => {
    const budget = createUnlimitedTokenBudget();
    budget.spend(10_000_000);
    assert.equal(budget.isExhausted(), false);
    assert.equal(budget.canAfford(1_000_000), true);
  });
});

describe('soma de uso de tokens', () => {
  it('soma as três parcelas', () => {
    const total = addTokenUsage(
      { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
    );
    assert.deepEqual(total, { promptTokens: 150, completionTokens: 30, totalTokens: 180 });
  });

  it('somar com o uso vazio não muda nada', () => {
    const usage = { promptTokens: 7, completionTokens: 3, totalTokens: 10 };
    assert.deepEqual(addTokenUsage(usage, EMPTY_TOKEN_USAGE), usage);
  });
});

describe('configuração do refino', () => {
  it('usa os defaults sem env', () => {
    const previousBudget = process.env.EXTRACTION_TOKEN_BUDGET_PER_DOCUMENT;
    const previousPasses = process.env.EXTRACTION_REFINEMENT_MAX_PASSES;
    delete process.env.EXTRACTION_TOKEN_BUDGET_PER_DOCUMENT;
    delete process.env.EXTRACTION_REFINEMENT_MAX_PASSES;
    try {
      assert.equal(getExtractionTokenBudget(), DEFAULT_EXTRACTION_TOKEN_BUDGET);
      assert.equal(getExtractionRefinementMaxPasses(), DEFAULT_EXTRACTION_REFINEMENT_MAX_PASSES);
    } finally {
      restoreEnv('EXTRACTION_TOKEN_BUDGET_PER_DOCUMENT', previousBudget);
      restoreEnv('EXTRACTION_REFINEMENT_MAX_PASSES', previousPasses);
    }
  });

  it('o refino fica desligado a menos que a env diga exatamente true', () => {
    const previous = process.env.EXTRACTION_REFINEMENT_ENABLED;
    try {
      delete process.env.EXTRACTION_REFINEMENT_ENABLED;
      assert.equal(isExtractionRefinementEnabled(), false);
      process.env.EXTRACTION_REFINEMENT_ENABLED = '1';
      assert.equal(isExtractionRefinementEnabled(), false);
      process.env.EXTRACTION_REFINEMENT_ENABLED = 'TRUE';
      assert.equal(isExtractionRefinementEnabled(), true);
    } finally {
      restoreEnv('EXTRACTION_REFINEMENT_ENABLED', previous);
    }
  });
});
