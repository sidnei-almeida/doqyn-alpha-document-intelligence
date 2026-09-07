import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_EXTRACTION_RULE_FIELDS } from '../server/services/documentDefaultExtractionRule.js';
import { deriveEndDates } from '../server/ai/utils/derivedDates.js';
import {
  CANONICAL_VALIDITY_KEY,
  canonicalizeMetadataKey,
} from '../shared/metadataKeyNormalize.js';
import { VALIDITY_SOURCE_KEYS } from '../server/services/confirm/projectSearchMeta.js';
import type { DocumentRuleField } from '../server/ai/types/documentAi.types.js';

const fields = DEFAULT_EXTRACTION_RULE_FIELDS as unknown as DocumentRuleField[];

describe('regra padrão de extração', () => {
  it('declara um campo de validade — sem ele o alerta não tem onde nascer', () => {
    const validity = fields.find((field) => field.key === CANONICAL_VALIDITY_KEY);
    assert.ok(validity, 'a regra padrão precisa do campo que VALIDITY_SOURCE_KEYS lê');
    assert.equal(validity!.type, 'date');
    assert.ok(VALIDITY_SOURCE_KEYS.has(CANONICAL_VALIDITY_KEY), 'a projeção precisa ler essa chave');
  });

  it('toda chave da regra padrão sobrevive à canonicalização', () => {
    // O campo nasceu como `data_vencimento` e aparecia eternamente vazio na ficha: ao confirmar a
    // versão, canonicalizeMetadataKey renomeia essa chave para `data_validade`, e a linha da regra
    // ficava sem dono enquanto o mesmo dado aparecia abaixo como campo fora da regra.
    for (const field of fields) {
      assert.equal(
        canonicalizeMetadataKey(field.key, field.label),
        field.key,
        `a chave "${field.key}" é renomeada ao confirmar — a regra nunca seria preenchida`,
      );
    }
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
    assert.equal(derived.targetKey, CANONICAL_VALIDITY_KEY);
    assert.equal(derived.value, '2029-06-09');
    assert.equal(derived.anchorKey, 'data_referencia');
    assert.equal(derived.durationKey, 'texto');
  });
});
