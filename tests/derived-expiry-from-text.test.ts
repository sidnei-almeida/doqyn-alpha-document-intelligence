import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveEndDates, findDurationInText } from '../server/ai/utils/derivedDates.js';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.js';

/**
 * A classe exata do caso real: "Contratos" com três campos e NENHUM campo de prazo. É essa
 * ausência que impedia a derivação — o prazo estava escrito no documento e não tinha onde pousar.
 */
const CONTRATOS: DocumentClassRule = {
  id: 'cat_contratos',
  name: 'Contratos',
  description: 'Contratos e acordos.',
  keywords: ['contrato'],
  fields: [
    { key: 'data_vencimento', label: 'Data de vencimento', type: 'date', required: true },
    { key: 'data_referencia', label: 'Data de referência', type: 'date', required: true },
    { key: 'partes_envolvidas', label: 'Partes envolvidas', type: 'string', required: true },
  ],
  namingTemplate: '{partes_envolvidas}',
};

const NDA = `
ACORDO DE CONFIDENCIALIDADE celebrado em 09 de junho de 2026.

6. NÃO ALICIAMENTO (3 ANOS)
Pelo prazo de 3 (três) anos, o RECEPTOR compromete-se a não contratar, aliciar ou tentar atrair
colaboradores, consultores ou parceiros estratégicos do REVELADOR.

7. PAGAMENTO
As despesas serão reembolsadas em 30 dias contados da apresentação do comprovante.
`;

const metadataDoCaso = {
  data_referencia: { value: '2026-06-09', normalizedValue: '2026-06-09' },
  partes_envolvidas: { value: 'CRISTIANO RAFAEL BALDISSERA e SIDNEI ALVES DE ALMEIDA' },
};

describe('prazo lido do texto', () => {
  it('acha o prazo ancorado no termo de validade, ignorando o prazo de pagamento', () => {
    // "30 dias" aparece no documento e é prazo de reembolso, não de vigência. Pegá-lo produziria
    // uma data de vencimento com cara de certa e origem errada.
    const found = findDurationInText(NDA);
    assert.deepEqual(found?.parsed, { amount: 3, unit: 'year' });
  });

  it('sem termo de validade por perto, não inventa prazo', () => {
    const semContexto = 'As despesas serão reembolsadas em 30 dias contados da apresentação.';
    assert.equal(findDurationInText(semContexto), null);
  });

  it('termo mais forte vence termo mais fraco', () => {
    // "vigora" governa o documento; "sigilo" descreve uma cláusula. A hierarquia existe para não
    // transformar toda ambiguidade em recusa.
    const doisPesos = 'A confidencialidade vigora por 5 (cinco) anos. O sigilo dura 2 (dois) anos.';
    assert.deepEqual(findDurationInText(doisPesos)?.parsed, { amount: 5, unit: 'year' });
  });

  it('dois prazos com o MESMO peso de contexto não viram escolha', () => {
    // Duas vigências diferentes no mesmo documento: as duas leituras são defensáveis e só uma está
    // certa. Devolver null mantém o campo vazio e o documento em revisão, que é a resposta honesta.
    const ambiguo = 'A vigência é de 5 (cinco) anos. A vigência do anexo é de 2 (dois) anos.';
    assert.equal(findDurationInText(ambiguo), null);
  });
});

describe('derivação de vencimento no caso real', () => {
  it('calcula data_vencimento a partir de data_referencia e do prazo no texto', () => {
    const derived = deriveEndDates(CONTRATOS.fields, metadataDoCaso, NDA);

    assert.equal(derived.length, 1);
    assert.equal(derived[0].targetKey, 'data_vencimento');
    assert.equal(derived[0].value, '2029-06-09', '09/06/2026 + 3 anos');
    assert.equal(derived[0].anchorKey, 'data_referencia');
    assert.equal(derived[0].durationKey, 'texto');
  });

  it('sem o texto, o caso volta a falhar — é a prova de que era isso que faltava', () => {
    assert.deepEqual(deriveEndDates(CONTRATOS.fields, metadataDoCaso), []);
  });

  it('data_referencia passou a contar como âncora', () => {
    // Antes a lista só reconhecia assinatura, emissão, início, firmado. O tenant nomeou o campo
    // como "referência" e a derivação parou sem que nada no resultado dissesse por quê.
    const semAncoraReconhecida = deriveEndDates(
      [
        { key: 'data_vencimento', label: 'Vencimento', type: 'date', required: true },
        { key: 'data_referencia', label: 'Referência', type: 'date', required: true },
      ],
      { data_referencia: { normalizedValue: '2026-06-09' } },
      NDA,
    );
    assert.equal(semAncoraReconhecida[0]?.value, '2029-06-09');
  });

  it('campo já preenchido pelo modelo é respeitado, não sobrescrito', () => {
    const derived = deriveEndDates(
      CONTRATOS.fields,
      { ...metadataDoCaso, data_vencimento: { normalizedValue: '2031-01-01' } },
      NDA,
    );
    assert.deepEqual(derived, []);
  });

  it('sem âncora não deriva nada, mesmo com prazo no texto', () => {
    const derived = deriveEndDates(CONTRATOS.fields, { partes_envolvidas: { value: 'X' } }, NDA);
    assert.deepEqual(derived, []);
  });
});
