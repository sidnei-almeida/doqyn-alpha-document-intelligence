import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findDurationInText,
  isAmbiguousNumericDate,
  normalizeDateValue,
  parseRelativeDuration,
} from '../server/ai/utils/derivedDates.ts';
import { applyFieldNormalization } from '../server/ai/utils/validation.ts';
import { buildCompactExtractorPrompt } from '../server/ai/utils/extractorPrompt.ts';
import { buildCompactClassifierPrompt } from '../server/ai/utils/classifierPrompt.ts';
import { resolveMetadataLabel } from '../shared/metadataKeyNormalize.ts';

const chunks = [{ id: 'c1', chunkId: 'c1', pageNumber: 1, text: 'Trecho.', score: 1 }] as never;
const contratos = {
  id: 'cat_contratos',
  name: 'Contratos',
  description: 'Contratos de prestação',
  keywords: [],
  fields: [
    { key: 'fornecedor', label: 'Fornecedor', type: 'string', required: true },
    { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: false },
  ],
  namingTemplate: '{fornecedor}',
} as never;
const dateField = { key: 'data_assinatura', label: 'Data', type: 'date', required: true } as never;

describe('português não muda: o prompt medido fica byte a byte igual', () => {
  it('extrator', () => {
    const base = buildCompactExtractorPrompt(chunks, contratos).prompt;
    for (const documentLanguage of ['pt', 'und'] as const) {
      assert.equal(
        buildCompactExtractorPrompt(chunks, contratos, { documentLanguage, outputLocale: 'pt-BR' })
          .prompt,
        base,
      );
    }
  });

  it('classificador', () => {
    const base = buildCompactClassifierPrompt(chunks, [contratos]).prompt;
    assert.equal(
      buildCompactClassifierPrompt(chunks, [contratos], { documentLanguage: 'pt' }).prompt,
      base,
    );
    assert.equal(
      buildCompactClassifierPrompt(chunks, [contratos], { documentLanguage: 'und' }).prompt,
      base,
    );
  });
});

describe('documento e leitor em outro idioma', () => {
  it('o extrator recebe a convenção de data e o idioma do resumo', () => {
    const en = buildCompactExtractorPrompt(chunks, contratos, { documentLanguage: 'en' }).prompt;
    assert.match(en, /mês antes do dia/);
    const es = buildCompactExtractorPrompt(chunks, contratos, {
      documentLanguage: 'es',
      outputLocale: 'en-US',
    }).prompt;
    assert.match(es, /dia antes do mês/);
    assert.match(es, /duas a três linhas, em inglês/);
  });

  it('o classificador é avisado de que idioma diferente não desqualifica a classe', () => {
    const prompt = buildCompactClassifierPrompt(chunks, [contratos], {
      documentLanguage: 'es',
    }).prompt;
    assert.match(prompt, /Idioma diferente não é sinal/);
  });
});

describe('datas e prazos em três idiomas', () => {
  it('data em algarismos: dia primeiro por padrão, mês primeiro quando pedido ou inevitável', () => {
    assert.equal(normalizeDateValue('03/09/2026'), '2026-09-03');
    assert.equal(normalizeDateValue('03/09/2026', { monthFirst: true }), '2026-03-09');
    assert.equal(normalizeDateValue('12/25/2026'), '2026-12-25');
    assert.equal(normalizeDateValue('25/12/2026', { monthFirst: true }), '2026-12-25');
    assert.equal(isAmbiguousNumericDate('03/09/2026'), true);
    assert.equal(isAmbiguousNumericDate('13/09/2026'), false);
  });

  it('data por extenso em português, espanhol e inglês', () => {
    assert.equal(normalizeDateValue('09 de junho de 2026'), '2026-06-09');
    assert.equal(normalizeDateValue('15 de marzo de 2026'), '2026-03-15');
    assert.equal(normalizeDateValue('March 4, 2026'), '2026-03-04');
    assert.equal(normalizeDateValue('4 March 2026'), '2026-03-04');
  });

  it('prazo com o algarismo dentro do parêntese', () => {
    assert.deepEqual(parseRelativeDuration('thirty-six (36) months'), {
      amount: 36,
      unit: 'month',
    });
    assert.deepEqual(parseRelativeDuration('tres (3) años'), { amount: 3, unit: 'year' });
    assert.deepEqual(parseRelativeDuration('3 (três) anos'), { amount: 3, unit: 'year' });
    const found = findDurationInText(
      'This Agreement shall remain in effect for a term of twenty-four (24) months from the Effective Date.',
    );
    assert.deepEqual(found?.parsed, { amount: 24, unit: 'month' });
  });

  it('documento em inglês: o literal ambíguo vence o ISO que o modelo leu ao contrário', () => {
    assert.equal(
      applyFieldNormalization(dateField, '03/09/2026', '2026-09-03', { documentLanguage: 'en' })
        .normalizedValue,
      '2026-03-09',
    );
    // Em português o ISO do modelo segue valendo, como antes.
    assert.equal(
      applyFieldNormalization(dateField, '03/09/2026', '2026-09-03', { documentLanguage: 'pt' })
        .normalizedValue,
      '2026-09-03',
    );
  });
});

describe('rótulo canônico no idioma de quem lê', () => {
  it('traduz o canônico e deixa o do tenant como está', () => {
    assert.equal(resolveMetadataLabel('data_validade'), 'Validade');
    assert.equal(resolveMetadataLabel('data_validade', null, 'en-US'), 'Expiry date');
    assert.equal(resolveMetadataLabel('fornecedor', null, 'es-419'), 'Proveedor');
    assert.equal(
      resolveMetadataLabel('campo_do_tenant', 'Número do lote', 'en-US'),
      'Número do lote',
    );
  });
});
