import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { triageExtraction } from '../server/ai/utils/extractionTriage.js';
import type {
  DocumentClassRule,
  ExtractedMetadataField,
  RetrievedChunk,
} from '../server/ai/types/documentAi.types.js';

const FINANCEIRO: DocumentClassRule = {
  id: 'cat_fin',
  name: 'Financeiro',
  description: 'Notas, boletos e recibos.',
  keywords: ['nota', 'boleto'],
  fields: [
    { key: 'fornecedor', label: 'Fornecedor', type: 'string', required: true },
    { key: 'numero_nota', label: 'Número da nota', type: 'string', required: true },
    { key: 'data_emissao', label: 'Data de emissão', type: 'date', required: true },
    { key: 'observacao', label: 'Observação', type: 'string', required: false },
  ],
  namingTemplate: '{fornecedor}_{data_emissao}',
};

function chunk(text: string): RetrievedChunk {
  return {
    id: 'c1',
    chunkIndex: 0,
    pageNumber: 1,
    text,
    score: 10,
    matchedTerms: [],
    reason: 'extraction',
  };
}

function field(partial: Partial<ExtractedMetadataField>): ExtractedMetadataField {
  return {
    label: 'x',
    value: null,
    confidence: 0.9,
    source: 'document_text',
    ...partial,
  };
}

const DOCUMENTO = chunk(
  'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda. Nota fiscal 4471. ' +
    'Data de emissão: 05/05/2026. Banco Cooperativo Vale Verde S.A.',
);

describe('triagem determinística', () => {
  it('documento completo e conferido não vira sintoma nenhum', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: {
        tipo: 'NOTA FISCAL',
        sujeitos: ['Talha Sul Serviços Industriais Ltda'],
        dataReferencia: '2026-05-05',
      },
      metadata: {
        fornecedor: field({
          value: 'Talha Sul Serviços Industriais Ltda',
          evidence: { snippet: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda' },
        }),
        numero_nota: field({
          value: '4471',
          evidence: { snippet: 'Nota fiscal 4471' },
        }),
        data_emissao: field({
          value: '05/05/2026',
          normalizedValue: '2026-05-05',
          evidence: { snippet: 'Data de emissão: 05/05/2026' },
        }),
      },
    });

    assert.equal(triage.clean, true, JSON.stringify(triage.findings, null, 2));
  });

  it('campo obrigatório vazio vira sintoma; campo opcional vazio não', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'NOTA FISCAL', sujeitos: ['Talha Sul'], dataReferencia: '2026-05-05' },
      metadata: {
        fornecedor: field({
          value: 'Talha Sul Serviços Industriais Ltda',
          evidence: { snippet: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda' },
        }),
        numero_nota: field({ value: null }),
        data_emissao: field({
          value: '05/05/2026',
          normalizedValue: '2026-05-05',
          evidence: { snippet: 'Data de emissão: 05/05/2026' },
        }),
      },
    });

    const keys = triage.findings.map((finding) => `${finding.key}:${finding.symptom}`);
    assert.deepEqual(keys, ['numero_nota:ausente']);
    assert.deepEqual(triage.suspectFieldKeys, ['numero_nota']);
  });

  it('trecho citado que não existe no documento é apontado como invenção', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'NOTA FISCAL', sujeitos: ['Talha Sul'], dataReferencia: '2026-05-05' },
      metadata: {
        fornecedor: field({
          value: 'Metalúrgica Aurora',
          evidence: { snippet: 'EMITENTE: Metalúrgica Aurora Comércio e Indústria Ltda' },
        }),
        numero_nota: field({ value: '4471', evidence: { snippet: 'Nota fiscal 4471' } }),
        data_emissao: field({
          value: '05/05/2026',
          normalizedValue: '2026-05-05',
          evidence: { snippet: 'Data de emissão: 05/05/2026' },
        }),
      },
    });

    assert.ok(
      triage.findings.some(
        (finding) => finding.key === 'fornecedor' && finding.symptom === 'evidencia_nao_confere',
      ),
      JSON.stringify(triage.findings),
    );
  });

  it('data fora de yyyy-mm-dd é normalização inválida, não campo ausente', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'NOTA FISCAL', sujeitos: ['Talha Sul'], dataReferencia: '2026-05-05' },
      metadata: {
        fornecedor: field({
          value: 'Talha Sul Serviços Industriais Ltda',
          evidence: { snippet: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda' },
        }),
        numero_nota: field({ value: '4471', evidence: { snippet: 'Nota fiscal 4471' } }),
        data_emissao: field({
          value: '05 de maio de 2026',
          normalizedValue: '05 de maio de 2026',
          evidence: { snippet: 'Data de emissão: 05/05/2026' },
        }),
      },
    });

    assert.deepEqual(
      triage.findings.map((finding) => finding.symptom),
      ['normalizacao_invalida'],
    );
  });
});

describe('triagem dos papéis de nomeação', () => {
  const metadataOk = {
    fornecedor: field({
      value: 'Talha Sul Serviços Industriais Ltda',
      evidence: { snippet: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda' },
    }),
    numero_nota: field({ value: '4471', evidence: { snippet: 'Nota fiscal 4471' } }),
    data_emissao: field({
      value: '05/05/2026',
      normalizedValue: '2026-05-05',
      evidence: { snippet: 'Data de emissão: 05/05/2026' },
    }),
  };

  it('sujeito vazio é sintoma — foi o que virou PROCURACAO em NDA_2026-04-16', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'PROCURACAO', sujeitos: [], dataReferencia: '2026-04-16' },
      metadata: metadataOk,
    });

    assert.deepEqual(triage.suspectNamingKeys, ['naming.sujeitos']);
  });

  it('sujeito que é só rótulo genérico conta como ausente', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'NOTA FISCAL', sujeitos: ['Contratante', 'Documento'], dataReferencia: null },
      metadata: metadataOk,
    });

    assert.ok(triage.suspectNamingKeys.includes('naming.sujeitos'));
  });

  it('tipo repetindo o nome da pasta é sintoma', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'Financeiro', sujeitos: ['Talha Sul'], dataReferencia: '2026-05-05' },
      metadata: metadataOk,
    });

    assert.ok(
      triage.findings.some((finding) => finding.symptom === 'tipo_igual_a_classe'),
      JSON.stringify(triage.findings),
    );
  });

  it('palavra colada é sintoma — o prompt pede espaço e ninguém conferia', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'ORDEMDECOMPRAINTERNA', sujeitos: ['Talha Sul'], dataReferencia: null },
      metadata: metadataOk,
    });

    assert.ok(triage.findings.some((finding) => finding.symptom === 'tipo_palavra_colada'));
  });

  it('data de referência fora do formato é sintoma', () => {
    const triage = triageExtraction({
      selectedClass: FINANCEIRO,
      chunks: [DOCUMENTO],
      naming: { tipo: 'NOTA FISCAL', sujeitos: ['Talha Sul'], dataReferencia: '05/05/2026' },
      metadata: metadataOk,
    });

    assert.ok(
      triage.findings.some((finding) => finding.symptom === 'data_referencia_invalida'),
    );
  });
});
