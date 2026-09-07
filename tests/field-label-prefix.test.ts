import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeStringFieldValue } from '../server/ai/services/documentValidators.js';
import type { DocumentRuleField } from '../server/ai/types/documentAi.types.js';

const campo: DocumentRuleField = {
  key: 'parte_reveladora',
  label: 'Parte reveladora',
  type: 'string',
  required: true,
};

const numeroNota: DocumentRuleField = {
  key: 'numero_nota',
  label: 'Número da nota',
  type: 'string',
  required: true,
};

describe('remoção de rótulo no início do valor', () => {
  it('não decapita nome que contém as letras "no"', () => {
    // O regex antigo tratava "no" como ordinal. Estes três saíram do conjunto difícil, e o
    // estrago era invisível: `value` ficava certo e só `normalizedValue` — o campo que busca,
    // ordena e compara — vinha mutilado.
    for (const nome of [
      'MERIDIANO SOFTWORKS LTDA.',
      'NORTIS ENGENHARIA S.A.',
      'ALDEIA TECNOLOGIA E AUTOMAÇÃO LTDA. - ME',
      'Antônio Nogueira Fernando',
      'Nova Prata Comércio Ltda',
      'Bruno Nogueira',
    ]) {
      assert.equal(normalizeStringFieldValue(nome, campo), nome);
    }
  });

  it('continua limpando ordinal tipográfico colado ao rótulo', () => {
    assert.equal(normalizeStringFieldValue('Fatura nº FAT-2026-00318-7', numeroNota), 'FAT-2026-00318-7');
    assert.equal(normalizeStringFieldValue('Nota n° 4471', numeroNota), '4471');
    assert.equal(normalizeStringFieldValue('Documento n.º ABC-1', numeroNota), 'ABC-1');
  });

  it('limpa o "no" em ASCII quando ele é palavra inteira antes de um número', () => {
    assert.equal(normalizeStringFieldValue('Nota fiscal no 4471', numeroNota), '4471');
  });

  it('continua limpando rótulo terminado em dois-pontos', () => {
    assert.equal(normalizeStringFieldValue('CONTRATANTE: Fulano de Tal', campo), 'Fulano de Tal');
    assert.equal(normalizeStringFieldValue('Nome: Bruno Nogueira', campo), 'Bruno Nogueira');
  });

  it('rótulo sem dado atrás continua sendo o próprio valor', () => {
    assert.equal(normalizeStringFieldValue('nº', numeroNota), 'nº');
  });
});
