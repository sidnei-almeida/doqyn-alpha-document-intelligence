import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planRepair } from '../scripts/repair-truncated-normalized-values.js';
import type { MongoVersionMetadataField } from '../server/db/types.js';

function field(value: string, normalizedValue: string): MongoVersionMetadataField {
  return { label: 'Campo', value, normalizedValue, confidence: 0.9, source: 'ai' };
}

describe('reparo de normalizedValue decapitado', () => {
  it('restaura o prefixo que o bug do "no" comeu', () => {
    const casos: Array<[string, string, string]> = [
      ['MERIDIANO SOFTWORKS LTDA.', 'SOFTWORKS LTDA.', 'MERIDIANO SOFTWORKS LTDA.'],
      ['NORTIS ENGENHARIA S.A.', 'RTIS ENGENHARIA S.A.', 'NORTIS ENGENHARIA S.A.'],
      [
        'ALDEIA TECNOLOGIA E AUTOMAÇÃO LTDA. - ME',
        'LOGIA E AUTOMAÇÃO LTDA. - ME',
        'ALDEIA TECNOLOGIA E AUTOMAÇÃO LTDA. - ME',
      ],
      ['Antônio Nogueira', 'gueira', 'Antônio Nogueira'],
    ];

    for (const [value, armazenado, esperado] of casos) {
      const plan = planRepair('fornecedor', field(value, armazenado));
      assert.ok(plan, `${value} deveria ser reparado`);
      assert.equal(plan?.depois, esperado);
    }
  });

  it('não mexe em rótulo que o sistema removeu de propósito', () => {
    // "Fatura nº FAT-2026" vira "FAT-2026" pela regra que continua valendo. Recomputar devolve o
    // mesmo valor, então não há o que reparar.
    assert.equal(planRepair('numero_nota', field('Fatura nº FAT-2026-00318-7', 'FAT-2026-00318-7')), null);
    assert.equal(planRepair('fornecedor', field('CONTRATANTE: Fulano de Tal', 'Fulano de Tal')), null);
    assert.equal(planRepair('numero_nota', field('Nota fiscal no 4471', '4471')), null);
  });

  it('não mexe em valor que nunca foi tocado', () => {
    assert.equal(planRepair('fornecedor', field('Talha Sul Ltda', 'Talha Sul Ltda')), null);
  });

  it('recusa o que não tem a assinatura do bug', () => {
    // O bug só removia prefixo. Armazenado que não é sufixo do literal veio de outra coisa, e
    // reescrevê-lo seria trocar um estrago desconhecido por outro.
    assert.equal(planRepair('fornecedor', field('Meridiano Softworks', 'Outra Empresa')), null);
    assert.equal(planRepair('fornecedor', field('Meridiano Softworks', 'Meridiano Soft')), null);
  });

  it('nunca encurta: o reparo só devolve texto', () => {
    // Armazenado mais longo que o recomputado não é vítima deste bug.
    assert.equal(planRepair('fornecedor', field('nº 4471', 'nº 4471')), null);
  });

  it('ignora campo numérico e campo sem normalizedValue', () => {
    assert.equal(
      planRepair('valor', { label: 'Valor', value: 27500, normalizedValue: 27500, confidence: 0.9, source: 'ai' }),
      null,
    );
    assert.equal(
      planRepair('fornecedor', { label: 'F', value: 'Nortis', confidence: 0.9, source: 'ai' }),
      null,
    );
  });
});
