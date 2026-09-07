import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findCoherenceProblems, typesDisagree } from '../server/ai/utils/fieldCoherence.js';
import { validateCnpj, validateCpf } from '../server/ai/services/documentValidators.js';
import { triageExtraction } from '../server/ai/utils/extractionTriage.js';
import { selectEvaluatorChunks } from '../server/ai/utils/evaluatorPrompt.js';
import type {
  DocumentClassRule,
  ExtractedMetadataField,
  RetrievedChunk,
} from '../server/ai/types/documentAi.types.js';

function field(value: string): ExtractedMetadataField {
  return {
    label: 'campo',
    value,
    normalizedValue: value,
    confidence: 0.9,
    source: 'document_text',
    evidence: { snippet: value },
  };
}

const CONTRATO: DocumentClassRule = {
  id: 'cat_contratos',
  name: 'Contratos',
  description: 'Contratos de prestação.',
  keywords: ['contrato'],
  fields: [
    { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: true },
    { key: 'data_validade', label: 'Data de validade', type: 'date', required: true },
    { key: 'cnpj_contratada', label: 'CNPJ da contratada', type: 'string', required: true },
  ],
  namingTemplate: '{data_assinatura}',
};

describe('dígito verificador de CPF e CNPJ', () => {
  it('aceita documento real, com ou sem pontuação', () => {
    assert.equal(validateCpf('529.982.247-25'), true);
    assert.equal(validateCpf('52998224725'), true);
    assert.equal(validateCnpj('11.222.333/0001-81'), true);
    assert.equal(validateCnpj('11222333000181'), true);
  });

  it('recusa número com dígito trocado — o caso do modelo que inventa', () => {
    assert.equal(validateCpf('529.982.247-24'), false);
    assert.equal(validateCnpj('11.222.333/0001-80'), false);
  });

  it('recusa sequência repetida, que fecha a conta por acidente', () => {
    assert.equal(validateCpf('111.111.111-11'), false);
    assert.equal(validateCnpj('11.111.111/1111-11'), false);
  });

  it('recusa tamanho errado', () => {
    assert.equal(validateCpf('1234567890'), false);
    assert.equal(validateCnpj('112223330001'), false);
  });
});

describe('coerência entre campos', () => {
  it('validade anterior à assinatura é apontada', () => {
    const problems = findCoherenceProblems({
      selectedClass: CONTRATO,
      metadata: {
        data_assinatura: field('2026-05-05'),
        data_validade: field('2026-04-01'),
        cnpj_contratada: field('11222333000181'),
      },
    });

    assert.equal(problems.length, 1);
    assert.equal(problems[0].key, 'data_validade');
    assert.ok(problems[0].detail.includes('anterior'));
  });

  it('ordem correta não gera problema', () => {
    const problems = findCoherenceProblems({
      selectedClass: CONTRATO,
      metadata: {
        data_assinatura: field('2026-05-05'),
        data_validade: field('2031-05-05'),
        cnpj_contratada: field('11222333000181'),
      },
    });

    assert.deepEqual(problems, []);
  });

  it('mesmo dia é válido — contrato que vence no dia da assinatura existe', () => {
    const problems = findCoherenceProblems({
      selectedClass: CONTRATO,
      metadata: {
        data_assinatura: field('2026-05-05'),
        data_validade: field('2026-05-05'),
        cnpj_contratada: field('11222333000181'),
      },
    });

    assert.deepEqual(problems, []);
  });

  it('CNPJ que não fecha o dígito é apontado', () => {
    const problems = findCoherenceProblems({
      selectedClass: CONTRATO,
      metadata: { cnpj_contratada: field('11222333000180') },
    });

    assert.equal(problems.length, 1);
    assert.equal(problems[0].key, 'cnpj_contratada');
    assert.ok(problems[0].detail.includes('dígito verificador'));
  });

  it('campo vazio não é incoerência', () => {
    assert.deepEqual(findCoherenceProblems({ selectedClass: CONTRATO, metadata: {} }), []);
  });
});

describe('divergência de tipo entre classificador e extrator', () => {
  it('tipos sem palavra em comum divergem', () => {
    assert.equal(typesDisagree('NDA', 'NOTA FISCAL'), true);
    assert.equal(typesDisagree('PROCURACAO', 'RECIBO'), true);
  });

  it('sinônimo com palavra em comum não é divergência', () => {
    assert.equal(typesDisagree('NDA', 'NDA RECIPROCO'), false);
    assert.equal(typesDisagree('ATESTADO MEDICO', 'ATESTADO'), false);
    assert.equal(typesDisagree('PROCURACAO', 'procuração'), false);
  });

  it('faltando um dos lados, não há o que comparar', () => {
    assert.equal(typesDisagree(null, 'NDA'), false);
    assert.equal(typesDisagree('NDA', undefined), false);
  });
});

describe('a triagem incorpora as conferências novas', () => {
  const chunk: RetrievedChunk = {
    id: 'c1',
    chunkIndex: 0,
    pageNumber: 1,
    text: 'Contrato assinado em 05/05/2026, válido até 01/04/2026. CNPJ 11.222.333/0001-80.',
    score: 10,
    matchedTerms: [],
    reason: 'extraction',
  };

  it('incoerência de data e CNPJ inválido viram sintomas', () => {
    const triage = triageExtraction({
      selectedClass: CONTRATO,
      chunks: [chunk],
      naming: { tipo: 'CONTRATO', sujeitos: ['Fulano'], dataReferencia: '2026-05-05' },
      metadata: {
        data_assinatura: field('2026-05-05'),
        data_validade: field('2026-04-01'),
        cnpj_contratada: field('11222333000180'),
      },
    });

    const sintomas = triage.findings.map((f) => f.symptom);
    assert.ok(sintomas.includes('incoerencia_entre_campos'));
    assert.equal(sintomas.filter((s) => s === 'incoerencia_entre_campos').length, 2);
  });

  it('tipo divergente entre os dois agentes vira sintoma', () => {
    const triage = triageExtraction({
      selectedClass: CONTRATO,
      chunks: [chunk],
      naming: { tipo: 'NOTA FISCAL', sujeitos: ['Fulano'], dataReferencia: '2026-05-05' },
      classifierDocumentType: 'CONTRATO DE LOCACAO',
      metadata: {
        data_assinatura: field('2026-05-05'),
        data_validade: field('2031-05-05'),
        cnpj_contratada: field('11222333000181'),
      },
    });

    assert.ok(triage.findings.some((f) => f.symptom === 'tipo_divergente'));
  });

  it('tipos concordando não geram sintoma', () => {
    const triage = triageExtraction({
      selectedClass: CONTRATO,
      chunks: [chunk],
      naming: { tipo: 'CONTRATO DE LOCACAO', sujeitos: ['Fulano'], dataReferencia: '2026-05-05' },
      classifierDocumentType: 'CONTRATO',
      metadata: {
        data_assinatura: field('2026-05-05'),
        data_validade: field('2031-05-05'),
        cnpj_contratada: field('11222333000181'),
      },
    });

    assert.ok(!triage.findings.some((f) => f.symptom === 'tipo_divergente'));
  });
});

describe('seleção de trechos para o Avaliador', () => {
  function chunk(id: string, text: string, score: number): RetrievedChunk {
    return { id, chunkIndex: Number(id.slice(1)), pageNumber: 1, text, score, matchedTerms: [], reason: 'extraction' };
  }

  it('documento curto vai inteiro, sem corte', () => {
    const chunks = [chunk('c0', 'um', 1), chunk('c1', 'dois', 2)];
    assert.equal(selectEvaluatorChunks({ chunks, metadata: {} }).length, 2);
  });

  it('documento longo é cortado, mas o trecho que sustenta a evidência fica', () => {
    // Sem esta regra, o Avaliador julgaria um valor sem poder conferir o trecho que o comprova —
    // e julgar sem poder conferir é adivinhar.
    const chunks = [
      ...Array.from({ length: 20 }, (_, i) => chunk(`c${i}`, `texto irrelevante ${i}`, 100 - i)),
      chunk('c99', 'BENEFICIARIO: Talha Sul Servicos Industriais Ltda', 0),
    ];

    const selecionados = selectEvaluatorChunks({
      chunks,
      metadata: {
        fornecedor: {
          label: 'Fornecedor',
          value: 'Talha Sul',
          confidence: 0.9,
          source: 'document_text',
          evidence: { snippet: 'BENEFICIARIO: Talha Sul Servicos Industriais Ltda' },
        },
      },
    });

    assert.ok(selecionados.length <= 8);
    assert.ok(
      selecionados.some((c) => c.id === 'c99'),
      'o trecho com a evidência tem score 0 e ainda assim precisa entrar',
    );
  });
});
