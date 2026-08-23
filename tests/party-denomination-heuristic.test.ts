import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enrichMetadataWithPartyHeuristics } from '../server/ai/utils/partyMetadataHeuristics.js';
import type { DocumentClassRule, RetrievedChunk } from '../server/ai/types/documentAi.types.js';

const ndaClass = {
  id: 'cls_nda',
  name: 'Acordo de Confidencialidade',
  description: 'NDA',
  namingTemplate: 'NDA_{parte_reveladora}_e_{parte_receptora}_{data_assinatura}_v{version}',
  fields: [],
} as unknown as DocumentClassRule;

const chunk = (text: string): RetrievedChunk =>
  ({ text, pageNumber: 1, score: 1 }) as unknown as RetrievedChunk;

/**
 * Layout real de contrato brasileiro: o nome abre o bloco, a qualificação ocupa o meio e o papel
 * só aparece no fim, na cláusula de denominação. Os padrões antigos exigiam rótulo antes do nome
 * e deixavam passar um documento inteiramente legível.
 */
const preamble = `ACORDO DE CONFIDENCIALIDADE (NDA)
PARTES
Pelo presente instrumento particular, de um lado:
MARIA HELENA SOUZA, brasileira, casada, inscrita no CPF nº 000.000.000-00, residente e
domiciliada em Porto Alegre/RS, doravante denominada REVELADORA;
e, de outro lado:
JOAO PEDRO LIMA, brasileiro, solteiro, inscrito no CPF nº 111.111.111-11, residente e
domiciliado em Caxias do Sul/RS, doravante denominado RECEPTOR;
As partes resolvem firmar o presente Acordo.`;

describe('partes pela cláusula de denominação', () => {
  it('extrai as duas partes quando o papel vem depois do nome', () => {
    const metadata = enrichMetadataWithPartyHeuristics({
      chunks: [chunk(preamble)],
      selectedClass: ndaClass,
      metadata: {},
    });

    assert.match(metadata.parte_reveladora?.value ?? '', /MARIA HELENA SOUZA/i);
    assert.match(metadata.parte_receptora?.value ?? '', /JOAO PEDRO LIMA/i);
  });

  it('não sobrescreve parte que a IA já extraiu', () => {
    const metadata = enrichMetadataWithPartyHeuristics({
      chunks: [chunk(preamble)],
      selectedClass: ndaClass,
      metadata: {
        parte_reveladora: {
          label: 'Parte reveladora',
          value: 'Acme Consultoria Ltda',
          normalizedValue: 'Acme Consultoria Ltda',
          confidence: 0.95,
        } as never,
      },
    });

    assert.match(metadata.parte_reveladora?.value ?? '', /Acme Consultoria/i);
  });

  it('documento sem cláusula de denominação continua sem partes inventadas', () => {
    const metadata = enrichMetadataWithPartyHeuristics({
      chunks: [chunk('Relatório trimestral de desempenho. Sumário executivo e anexos.')],
      selectedClass: ndaClass,
      metadata: {},
    });

    assert.equal(metadata.parte_reveladora, undefined);
    assert.equal(metadata.parte_receptora, undefined);
  });
});
