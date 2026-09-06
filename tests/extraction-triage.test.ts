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
  it('classe financeira nunca é dispensada, mesmo sem sintoma algum', () => {
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

    // Nenhum sintoma: tudo preenchido, conferido e no formato.
    assert.deepEqual(triage.findings, []);
    // Ainda assim vai a julgamento. `fornecedor` ao lado de `numero_nota` é a classe onde metade
    // das falhas medidas mora, e todas com valor plausível — o banco do boleto, o pagador do
    // recibo, o número do talão. Ausência de sintoma é o próprio problema aqui.
    assert.equal(triage.errorProneClass, true);
    assert.equal(triage.clean, false);
  });

  it('classe comum sem sintoma é dispensada e não gasta chamada', () => {
    const simples: DocumentClassRule = {
      id: 'cat_op',
      name: 'Operacional',
      description: 'Laudos.',
      keywords: ['laudo'],
      fields: [{ key: 'titulo', label: 'Título', type: 'string', required: true }],
      namingTemplate: '{titulo}',
    };

    const triage = triageExtraction({
      selectedClass: simples,
      chunks: [chunk('LAUDO DE ENSAIO DE ESTANQUEIDADE em linha de amônia.')],
      naming: { tipo: 'LAUDO', sujeitos: ['Talha Sul'], dataReferencia: '2026-09-18' },
      metadata: {
        titulo: field({
          value: 'Laudo de ensaio de estanqueidade',
          evidence: { snippet: 'LAUDO DE ENSAIO DE ESTANQUEIDADE em linha de amônia' },
        }),
      },
    });

    assert.deepEqual(triage.findings, []);
    assert.equal(triage.clean, true);
  });

  it('várias datas no documento viram disputa, com os candidatos na mão', () => {
    // O caso de `juridico_04` e `operacional_01`: o valor escolhido é uma data real, citada por um
    // trecho real, no formato certo. Nenhuma conferência mecânica tinha o que apontar — o que dá
    // para apontar é que havia quatro para escolher.
    const comDatas = chunk(
      'Lavrado aos treze dias do mês de abril do ano de dois mil e vinte e seis. ' +
        'Reconhecimento de firma em 16/04/2026. Impresso em 02/04/2026.',
    );

    const classe: DocumentClassRule = {
      id: 'cat_jur',
      name: 'Jurídico',
      description: 'Procurações.',
      keywords: ['procuração'],
      fields: [
        { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: true },
      ],
      namingTemplate: '{data_assinatura}',
    };

    const triage = triageExtraction({
      selectedClass: classe,
      chunks: [comDatas],
      naming: { tipo: 'PROCURACAO', sujeitos: ['Otávio Pilar'], dataReferencia: '2026-04-13' },
      metadata: {
        data_assinatura: field({
          value: '16/04/2026',
          normalizedValue: '2026-04-16',
          evidence: { snippet: 'Reconhecimento de firma em 16/04/2026' },
        }),
      },
    });

    const disputa = triage.findings.find((f) => f.symptom === 'valor_disputado');
    assert.ok(disputa, JSON.stringify(triage.findings));
    // Só as datas em algarismos: o selo do cartório e a impressão. A lavratura, por extenso, fica
    // de fora — e as duas que sobram estão erradas. É por isso que o prompt manda procurar fora da
    // lista quando nenhum candidato faz o papel pedido, em vez de escolher o menos ruim.
    assert.deepEqual(disputa?.candidates, ['2026-04-16', '2026-04-02']);
  });

  it('data única no documento não vira disputa', () => {
    const classe: DocumentClassRule = {
      id: 'cat_jur',
      name: 'Jurídico',
      description: 'Procurações.',
      keywords: ['procuração'],
      fields: [
        { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: true },
      ],
      namingTemplate: '{data_assinatura}',
    };

    const triage = triageExtraction({
      selectedClass: classe,
      chunks: [chunk('Assinado em 13/04/2026 pelas partes.')],
      naming: { tipo: 'PROCURACAO', sujeitos: ['Otávio Pilar'], dataReferencia: '2026-04-13' },
      metadata: {
        data_assinatura: field({
          value: '13/04/2026',
          normalizedValue: '2026-04-13',
          evidence: { snippet: 'Assinado em 13/04/2026' },
        }),
      },
    });

    assert.deepEqual(triage.findings, []);
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
