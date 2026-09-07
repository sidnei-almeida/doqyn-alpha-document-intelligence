import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildStandardDetailsFields } from '../src/features/document-update-version/utils/documentMetadataDisplay.ts';
import { DEFAULT_EXTRACTION_RULE_FIELDS } from '../server/services/documentDefaultExtractionRule.js';
import { VALIDITY_ABSOLUTE_KEYS } from '../shared/metadataKeyNormalize.js';

const metadata = {
  data_referencia: {
    label: 'Data de referência',
    value: '2026-06-09',
    normalizedValue: '2026-06-09',
  },
  data_validade: { label: 'Validade', value: '2033-06-09', normalizedValue: '2033-06-09' },
  partes_envolvidas: {
    label: 'Partes envolvidas',
    value: 'CRISTIANO RAFAEL BALDISSERA; SIDNEI ALVES DE ALMEIDA',
  },
};

describe('ficha do painel Detalhes', () => {
  it('mostra todos os campos da regra padrão, não só a validade', () => {
    // O painel listava por uma lista fixa de chaves que ignorava a regra padrão. Um documento
    // comum aparecia só com a validade, e "partes envolvidas" — quem é o dono do assunto — só
    // existia dentro do editor de metadados, que é tela de edição, não de leitura.
    const fields = buildStandardDetailsFields({
      metadata,
      searchMeta: { validityDate: '2033-06-09', people: [] },
    });
    const byKey = new Map(fields.map((field) => [field.key, field.value]));

    for (const ruleField of DEFAULT_EXTRACTION_RULE_FIELDS) {
      // A validade é unificada num campo `validity` — o builder junta as várias chaves possíveis
      // (data_validade, vigencia_fim, inferida) numa linha só.
      const key = VALIDITY_ABSOLUTE_KEYS.has(ruleField.key) ? 'validity' : ruleField.key;
      assert.ok(byKey.has(key), `campo "${ruleField.key}" sumiu do painel Detalhes`);
    }
    assert.equal(byKey.get('partes_envolvidas'), 'CRISTIANO RAFAEL BALDISSERA; SIDNEI ALVES DE ALMEIDA');
  });

  it('data aparece em dd/mm/aaaa, não no ISO cru', () => {
    const fields = buildStandardDetailsFields({ metadata, searchMeta: null });
    assert.equal(fields.find((f) => f.key === 'data_referencia')?.value, '09/06/2026');
  });

  it('o vencimento tem linha própria ao lado de Criado e Atualizado', () => {
    const source = readFileSync(
      'src/features/documents/components/DocumentDetailsShared.tsx',
      'utf8',
    );
    assert.ok(source.includes('label="Vencimento"'));
    assert.ok(source.includes('searchMeta?.validityDate'));
  });
});
