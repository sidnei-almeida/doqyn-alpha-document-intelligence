import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_EXTRACTION_RULE_FIELDS } from '../server/services/documentDefaultExtractionRule.js';
import { deriveEndDates } from '../server/ai/utils/derivedDates.js';
import type { DocumentRuleField } from '../server/ai/types/documentAi.types.js';

const fields = DEFAULT_EXTRACTION_RULE_FIELDS as unknown as DocumentRuleField[];

describe('regra padrão de extração', () => {
  it('declara um campo de vencimento — sem ele o alerta não tem onde nascer', () => {
    const validity = fields.find((field) => field.key === 'data_vencimento');
    assert.ok(validity, 'a regra padrão precisa do campo que VALIDITY_SOURCE_KEYS lê');
    assert.equal(validity!.type, 'date');
  });

  it('o vencimento é derivado da âncora e do prazo escrito no corpo', () => {
    const [derived] = deriveEndDates(
      fields,
      {
        data_referencia: { normalizedValue: '2026-06-09' },
        partes_envolvidas: { value: 'CRISTIANO RAFAEL BALDISSERA; SIDNEI ALVES DE ALMEIDA' },
      },
      'ACORDO DE CONFIDENCIALIDADE celebrado em 09 de junho de 2026. ' +
        '6. NÃO ALICIAMENTO (3 ANOS). Pelo prazo de 3 (três) anos, o RECEPTOR compromete-se a não aliciar.',
    );

    assert.ok(derived, 'a classe padrão precisa ter onde pousar a data calculada');
    assert.equal(derived.targetKey, 'data_vencimento');
    assert.equal(derived.value, '2029-06-09');
    assert.equal(derived.anchorKey, 'data_referencia');
    assert.equal(derived.durationKey, 'texto');
  });
});
