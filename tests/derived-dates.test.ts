import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDuration,
  deriveEndDates,
  parseRelativeDuration,
} from '../server/ai/utils/derivedDates.js';
import type { DocumentRuleField } from '../server/ai/types/documentAi.types.js';

const field = (over: Partial<DocumentRuleField> & { key: string }): DocumentRuleField =>
  ({
    label: over.key,
    type: 'string',
    required: false,
    ...over,
  }) as DocumentRuleField;

describe('parseRelativeDuration', () => {
  it('lê prazo em anos, meses e dias escrito como aparece em contrato', () => {
    assert.deepEqual(parseRelativeDuration('7 anos'), { amount: 7, unit: 'year' });
    assert.deepEqual(parseRelativeDuration('7 (sete) anos'), { amount: 7, unit: 'year' });
    assert.deepEqual(parseRelativeDuration('24 meses'), { amount: 24, unit: 'month' });
    assert.deepEqual(parseRelativeDuration('1 mês'), { amount: 1, unit: 'month' });
    assert.deepEqual(parseRelativeDuration('180 dias'), { amount: 180, unit: 'day' });
  });

  it('converte semana e quinzena para dias', () => {
    assert.deepEqual(parseRelativeDuration('3 semanas'), { amount: 21, unit: 'day' });
    assert.deepEqual(parseRelativeDuration('2 quinzenas'), { amount: 30, unit: 'day' });
  });

  it('devolve null quando não há prazo reconhecível', () => {
    assert.equal(parseRelativeDuration('indeterminado'), null);
    assert.equal(parseRelativeDuration('2026-06-09'), null);
    assert.equal(parseRelativeDuration(''), null);
    assert.equal(parseRelativeDuration(null), null);
    assert.equal(parseRelativeDuration(42), null);
  });
});

describe('addDuration', () => {
  it('soma anos, meses e dias', () => {
    assert.equal(addDuration('2026-06-09', { amount: 7, unit: 'year' }), '2033-06-09');
    assert.equal(addDuration('2026-01-15', { amount: 24, unit: 'month' }), '2028-01-15');
    assert.equal(addDuration('2026-01-01', { amount: 180, unit: 'day' }), '2026-06-30');
  });

  it('fixa no último dia do mês quando o dia não existe no destino', () => {
    // 31/01 + 1 mês não é 03/03: prazo contratual não escorrega para o mês seguinte
    assert.equal(addDuration('2026-01-31', { amount: 1, unit: 'month' }), '2026-02-28');
    assert.equal(addDuration('2024-01-31', { amount: 1, unit: 'month' }), '2024-02-29');
  });

  it('atravessa a virada do ano', () => {
    assert.equal(addDuration('2026-11-30', { amount: 3, unit: 'month' }), '2027-02-28');
  });

  it('rejeita âncora que não seja ISO válida', () => {
    assert.equal(addDuration('09/06/2026', { amount: 1, unit: 'year' }), null);
    assert.equal(addDuration('2026-02-30', { amount: 1, unit: 'year' }), null);
    assert.equal(addDuration('', { amount: 1, unit: 'year' }), null);
  });
});

describe('deriveEndDates', () => {
  const ndaFields = [
    field({ key: 'data_assinatura', label: 'Data de assinatura', type: 'date' }),
    field({ key: 'prazo_vigencia', label: 'Prazo de vigência' }),
    field({ key: 'data_validade', label: 'Data de validade', type: 'date' }),
  ];

  it('calcula a data final a partir de âncora e prazo', () => {
    const [derived] = deriveEndDates(ndaFields, {
      data_assinatura: { normalizedValue: '2026-06-09' },
      prazo_vigencia: { value: '7 (sete) anos' },
      data_validade: { value: null },
    });

    assert.equal(derived.targetKey, 'data_validade');
    assert.equal(derived.value, '2033-06-09');
    assert.equal(derived.anchorKey, 'data_assinatura');
    assert.equal(derived.durationKey, 'prazo_vigencia');
  });

  it('não sobrescreve data final que veio no documento', () => {
    const derived = deriveEndDates(ndaFields, {
      data_assinatura: { normalizedValue: '2026-06-09' },
      prazo_vigencia: { value: '7 anos' },
      data_validade: { normalizedValue: '2030-01-01' },
    });

    assert.equal(derived.length, 0);
  });

  it('não inventa nada sem âncora, sem prazo ou sem campo de destino', () => {
    assert.equal(
      deriveEndDates(ndaFields, { prazo_vigencia: { value: '7 anos' } }).length,
      0,
      'sem âncora não calcula',
    );
    assert.equal(
      deriveEndDates(ndaFields, { data_assinatura: { normalizedValue: '2026-06-09' } }).length,
      0,
      'sem prazo não calcula',
    );
    assert.equal(
      deriveEndDates(
        [field({ key: 'data_assinatura', type: 'date' }), field({ key: 'prazo_vigencia' })],
        { data_assinatura: { normalizedValue: '2026-06-09' }, prazo_vigencia: { value: '7 anos' } },
      ).length,
      0,
      'sem campo de destino não calcula',
    );
  });

  it('recusa âncora que não esteja em ISO — normalização é pré-requisito', () => {
    const derived = deriveEndDates(ndaFields, {
      data_assinatura: { value: '09 de junho de 2026' },
      prazo_vigencia: { value: '7 anos' },
    });

    assert.equal(derived.length, 0);
  });

  it('funciona em outro tipo documental sem nenhuma regra específica', () => {
    // Apólice: vocabulário totalmente diferente, mesma mecânica.
    const apoliceFields = [
      field({ key: 'inicio_cobertura', label: 'Início da cobertura', type: 'date' }),
      field({ key: 'prazo', label: 'Prazo', description: 'Duração da cobertura contratada.' }),
      field({ key: 'vencimento', label: 'Vencimento da apólice', type: 'date' }),
    ];

    const [derived] = deriveEndDates(apoliceFields, {
      inicio_cobertura: { normalizedValue: '2026-03-01' },
      prazo: { value: '12 meses' },
    });

    assert.equal(derived.targetKey, 'vencimento');
    assert.equal(derived.value, '2027-03-01');
  });
});
