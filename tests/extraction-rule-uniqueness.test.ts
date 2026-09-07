import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { pickActiveRule } from '../server/services/documentRulesService.js';

const rule = (id: string, over: Partial<{ version: number; updatedAt: Date }> = {}) => ({
  _id: id,
  version: 1,
  updatedAt: new Date('2026-09-01T04:15:54.302Z'),
  ...over,
});

describe('uma classe, uma regra ativa', () => {
  it('empate de versão desempata pela mais recente, nunca pela ordem do banco', () => {
    const antiga = rule('ext_cat_x_v1');
    const nova = rule('ext_uuid', { updatedAt: new Date('2026-09-01T04:15:54.326Z') });

    const escolhida = pickActiveRule([antiga, nova], { tenantId: 't', classId: 'cat_x' });
    const invertida = pickActiveRule([nova, antiga], { tenantId: 't', classId: 'cat_x' });

    assert.equal(escolhida?._id, 'ext_uuid');
    assert.equal(invertida?._id, escolhida?._id, 'a ordem da lista não pode mudar a resposta');
  });

  it('versão maior vence data mais recente', () => {
    const v2 = rule('ext_v2', { version: 2, updatedAt: new Date('2026-01-01T00:00:00Z') });
    const v1 = rule('ext_v1', { version: 1, updatedAt: new Date('2026-09-01T00:00:00Z') });

    assert.equal(pickActiveRule([v1, v2], { tenantId: 't', classId: 'cat_x' })?._id, 'ext_v2');
  });

  it('criar categoria não pode gravar uma segunda regra por cima', () => {
    // createDocumentCategory já garante a regra padrão por dentro; o handler chamava outro criador
    // logo depois, e o resultado eram duas regras v1 com 25 ms de diferença.
    for (const path of ['api/document-categories/index.ts', 'api/document-classes/index.ts']) {
      const source = readFileSync(path, 'utf8');
      assert.equal(
        source.includes('createDefaultExtractionRuleForCategory'),
        false,
        `${path} não pode criar regra por fora de createDocumentCategory`,
      );
    }
  });
});
