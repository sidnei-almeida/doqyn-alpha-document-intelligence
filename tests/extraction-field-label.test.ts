import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExtractedValue } from '../server/ai/services/documentValidators.js';

/**
 * O rótulo colado no valor.
 *
 * O prompt manda remover ("CONTRATANTE:", "Nome:") e o modelo obedece na maior
 * parte das vezes — menos em campo de número, onde "Fatura nº FAT-2026-00318-7"
 * chegava inteiro e quebrava a comparação. Como `value` guarda o literal do
 * documento e só `normalizedValue` é usado para buscar e ordenar, limpar aqui
 * não perde evidência nenhuma.
 */
describe('rótulo colado no valor extraído', () => {
  it('remove o rótulo antes do número', () => {
    assert.equal(
      normalizeExtractedValue('Fatura nº FAT-2026-00318-7', 'string'),
      'FAT-2026-00318-7',
    );
    assert.equal(normalizeExtractedValue('Nota fiscal nº 000.114.882', 'string'), '000.114.882');
    assert.equal(normalizeExtractedValue('Nº 0447', 'string'), '0447');
  });

  it('remove o rótulo antes dos dois-pontos', () => {
    assert.equal(normalizeExtractedValue('Nome: Maria Silva', 'string'), 'Maria Silva');
    assert.equal(normalizeExtractedValue('CONTRATANTE: ACME Ltda', 'string'), 'ACME Ltda');
  });

  it('não mexe em valor que não tem rótulo', () => {
    for (const value of [
      'Metalúrgica Três Coroas Ltda.',
      'Aparecida Simões da Rocha',
      '000.114.882',
      '2026/04471',
      'FAT-2026-00318-7',
    ]) {
      assert.equal(normalizeExtractedValue(value, 'string'), value, value);
    }
  });

  it('rótulo sem dado atrás continua sendo o valor', () => {
    // "Nº" sozinho não é rótulo de coisa nenhuma — é o que havia para ler.
    assert.equal(normalizeExtractedValue('Nº', 'string'), 'Nº');
  });
});
