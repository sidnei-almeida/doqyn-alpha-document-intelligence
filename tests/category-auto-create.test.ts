import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_CATEGORY_AUTO_CREATE_LIMIT,
  createCategoryFromSuggestion,
  resolveAutoCreatedCategoryId,
  type CategoryAutoCreateDeps,
} from '../server/services/categoryAutoCreateService.js';
import type { SuggestedCategory } from '../server/ai/types/documentAi.types.js';
import {
  DEFAULT_TENANT_UPLOAD_POLICY,
  type CategorySuggestionMode,
} from '../shared/uploadPolicy.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

const suggestion: SuggestedCategory = {
  name: 'Boletos',
  description: 'Boletos bancários e faturas de cobrança com linha digitável e vencimento.',
  keywords: ['boleto', 'cedente'],
  reason: 'Nenhuma pasta existente cobre cobrança bancária.',
};

function deps(overrides: Partial<CategoryAutoCreateDeps> = {}): CategoryAutoCreateDeps {
  return {
    findBySlug: async () => null,
    countCreatedByAi: async () => 0,
    create: async ({ suggestion: proposed }) => ({ id: 'cat_boletos', name: proposed.name }),
    ...overrides,
  };
}

function policyReader(mode: CategorySuggestionMode) {
  return async () => ({ ...DEFAULT_TENANT_UPLOAD_POLICY, categorySuggestionMode: mode });
}

describe('criação automática da categoria sugerida', () => {
  it('cria a pasta quando ela não existe', async () => {
    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: deps(),
    });

    assert.deepEqual(result, { categoryId: 'cat_boletos', outcome: 'created' });
  });

  it('reaproveita a pasta existente em vez de criar a segunda igual', async () => {
    // O modelo propõe a mesma pasta para o segundo boleto que propôs para o primeiro; criar de
    // novo seria recusado com DUPLICATE_SLUG, e reaproveitar não consome cota nenhuma.
    let created = false;

    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: deps({
        findBySlug: async () => 'cat_ja_existia',
        create: async () => {
          created = true;
          return { id: 'cat_nova', name: 'Boletos' };
        },
      }),
    });

    assert.deepEqual(result, { categoryId: 'cat_ja_existia', outcome: 'reused' });
    assert.equal(created, false, 'pasta existente não pode ser recriada');
  });

  it('para no teto e deixa o documento cair em "Sem categoria"', async () => {
    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: deps({ countCreatedByAi: async () => AI_CATEGORY_AUTO_CREATE_LIMIT }),
    });

    assert.equal(result, null);
  });

  it('cria enquanto está uma abaixo do teto', async () => {
    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: deps({ countCreatedByAi: async () => AI_CATEGORY_AUTO_CREATE_LIMIT - 1 }),
    });

    assert.equal(result?.outcome, 'created');
  });

  it('perder a corrida para outro envio não é erro — a pasta do vizinho serve', async () => {
    let lookups = 0;

    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: deps({
        findBySlug: async () => {
          lookups += 1;
          return lookups === 1 ? null : 'cat_do_vizinho';
        },
        create: async () => {
          throw new ServiceError('Já existe uma categoria com este slug.', 'DUPLICATE_SLUG', 409);
        },
      }),
    });

    assert.deepEqual(result, { categoryId: 'cat_do_vizinho', outcome: 'reused' });
  });

  it('falha de escrita devolve null em vez de derrubar a confirmação', async () => {
    // O documento tem destino de reserva ("Sem categoria"); recusar aqui custaria o documento
    // inteiro, já com o binário no R2.
    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: deps({
        create: async () => {
          throw new Error('mongo caiu');
        },
      }),
    });

    assert.equal(result, null);
  });

  it('nome que não vira slug não cria nada', async () => {
    const result = await createCategoryFromSuggestion({
      tenantId: 't1',
      userId: 'u1',
      suggestion: { ...suggestion, name: '///' },
      deps: deps(),
    });

    assert.equal(result, null);
  });
});

describe('a política do tenant é quem autoriza a escrita', () => {
  it('cria só em auto_create', async () => {
    const id = await resolveAutoCreatedCategoryId({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: { ...deps(), readPolicy: policyReader('auto_create') },
    });

    assert.equal(id, 'cat_boletos');
  });

  it('não cria em suggest nem em off, mesmo com a proposta no payload', async () => {
    // A política é lida no servidor de propósito: um payload forjado com `suggestedCategory` não
    // pode criar pasta num tenant que escolheu revisar cada uma.
    for (const mode of ['suggest', 'off'] as const) {
      const id = await resolveAutoCreatedCategoryId({
        tenantId: 't1',
        userId: 'u1',
        suggestion,
        deps: { ...deps(), readPolicy: policyReader(mode) },
      });

      assert.equal(id, undefined, mode);
    }
  });

  it('sem proposta não lê política nem escreve nada', async () => {
    let read = false;

    const id = await resolveAutoCreatedCategoryId({
      tenantId: 't1',
      userId: 'u1',
      suggestion: null,
      deps: {
        ...deps(),
        readPolicy: async () => {
          read = true;
          return DEFAULT_TENANT_UPLOAD_POLICY;
        },
      },
    });

    assert.equal(id, undefined);
    assert.equal(read, false);
  });

  it('política ilegível não cria pasta — na dúvida, "Sem categoria"', async () => {
    const id = await resolveAutoCreatedCategoryId({
      tenantId: 't1',
      userId: 'u1',
      suggestion,
      deps: {
        ...deps(),
        readPolicy: async () => {
          throw new Error('mongo caiu');
        },
      },
    });

    assert.equal(id, undefined);
  });
});
