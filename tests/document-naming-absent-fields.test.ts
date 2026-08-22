import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendedFileName } from '../server/ai/services/documentNaming.js';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.js';

const generalClass = {
  id: 'cls_geral',
  name: 'Documentos Gerais',
  description: 'Documentos sem classe específica',
  namingTemplate: '{titulo}_{data_emissao}_v{version}',
  fields: [],
} as unknown as DocumentClassRule;

const contractClass = {
  id: 'cls_contratos',
  name: 'Contratos',
  description: 'Contratos em geral',
  namingTemplate: '{titulo}_{data_assinatura}_v{version}',
  fields: [],
} as unknown as DocumentClassRule;

function field(value: string) {
  return { label: '', value, normalizedValue: value, confidence: 0.9 };
}

describe('nome do arquivo quando faltam metadados', () => {
  it('não deixa o marcador de data ausente virar o nome do arquivo', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'Invoice-BXZYLFIE-0003.pdf',
      selectedClass: generalClass,
      metadata: {},
      version: 'v1.0',
    });

    // Antes saía `sem_data_v1_0.pdf`: o marcador tem underscore e escapava do filtro de segmento.
    assert.ok(!/sem_data/i.test(name), `nome não deve conter marcador de ausência: ${name}`);
    assert.ok(name.includes('Invoice'), `nome deve preservar o documento original: ${name}`);
  });

  it('não repete o mesmo bloco de segmentos', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'pitch.pdf',
      selectedClass: generalClass,
      metadata: {
        titulo: field('Fornada de Casa'),
        fornecedor: field('Fornada de Casa'),
      },
      version: 'v1.0',
    });

    const segments = name.replace(/\.pdf$/i, '').toLowerCase().split('_');
    const firstRun = segments.slice(0, 3).join('_');
    assert.ok(
      !segments.slice(3).join('_').startsWith(firstRun),
      `nome não deve repetir o mesmo bloco: ${name}`,
    );
  });

  it('usa o título do documento quando não há parte identificada', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'scan.pdf',
      selectedClass: contractClass,
      metadata: {
        titulo: field('Acordo de Confidencialidade'),
        data_assinatura: field('2026-06-09'),
      },
      version: 'v1.0',
    });

    // Antes: `Contratos_2026-06-09.pdf`, que não diz o que o documento é.
    assert.match(name, /Confidencialidade/i, `nome deve dizer o que é o documento: ${name}`);
  });
});
