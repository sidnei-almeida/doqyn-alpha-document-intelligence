import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateClassificationResult } from '../server/ai/utils/validation.js';
import { buildCompactClassifierPrompt } from '../server/ai/utils/classifierPrompt.js';
import { buildClassificationReviewPrompt } from '../server/ai/services/classificationReviewAgent.js';
import type {
  DocumentClassRule,
  RetrievedChunk,
} from '../server/ai/types/documentAi.types.js';

const IDS = ['cat_juridico', 'cat_contratos'];

function base(extra: Record<string, unknown> = {}) {
  return {
    tipoDocumental: 'NDA',
    classId: 'cat_juridico',
    className: 'Jurídico',
    confidence: 0.95,
    requiresReview: false,
    reason: 'acordo de confidencialidade',
    evidence: [{ pageNumber: 1, snippet: 'ACORDO DE CONFIDENCIALIDADE' }],
    ...extra,
  };
}

describe('tipo documental declarado pelo classificador', () => {
  it('sobrevive ao resultado e chega a quem precisa dele', () => {
    const result = validateClassificationResult(base(), IDS);
    assert.equal(result.documentType, 'NDA');
  });

  it('descarta tipo genérico, vazio ou igual ao nome da pasta', () => {
    for (const tipo of ['DOCUMENTO', 'arquivo', '   ', 'Jurídico']) {
      const result = validateClassificationResult(base({ tipoDocumental: tipo }), IDS);
      assert.equal(result.documentType, null, `tipo ${JSON.stringify(tipo)}`);
    }
  });

  it('ausência do campo não quebra nada', () => {
    const { tipoDocumental: _ignorado, ...semTipo } = base();
    const result = validateClassificationResult(semTipo, IDS);
    assert.equal(result.documentType, null);
    assert.equal(result.classId, 'cat_juridico');
  });
});

describe('alternativa considerada', () => {
  it('alternativa descartada com argumento preserva a confiança alta', () => {
    const result = validateClassificationResult(
      base({
        alternativa: {
          classId: 'cat_contratos',
          porQueNao: 'não há contraprestação nem objeto contratado, só dever de sigilo recíproco',
        },
      }),
      IDS,
    );

    assert.equal(result.confidence, 0.95);
    assert.equal(result.requiresReview, false);
  });

  it('alternativa nomeada sem argumento derruba a confiança e manda revisar', () => {
    // O erro que sobrava: NDA classificado como Contratos a 0.97, sem nada no resultado
    // registrando que havia opção melhor. Nomear a segunda classe sem saber separá-la das duas
    // é confessar que elas não foram separadas.
    const result = validateClassificationResult(
      base({ alternativa: { classId: 'cat_contratos', porQueNao: 'não' } }),
      IDS,
    );

    assert.ok(result.confidence < 0.7, `confiança ficou em ${result.confidence}`);
    assert.equal(result.requiresReview, true);
  });

  it('sem segunda opção plausível, alternativa null não penaliza', () => {
    const result = validateClassificationResult(base({ alternativa: null }), IDS);
    assert.equal(result.confidence, 0.95);
    assert.equal(result.requiresReview, false);
  });

  it('alternativa sem classId é como não ter alternativa', () => {
    const result = validateClassificationResult(
      base({ alternativa: { porQueNao: '' } }),
      IDS,
    );
    assert.equal(result.confidence, 0.95);
  });
});

describe('prompts carregam as regras novas', () => {
  const classes: DocumentClassRule[] = [
    {
      id: 'cat_juridico',
      name: 'Jurídico',
      description: 'NDA, procurações e pareceres.',
      keywords: ['confidencialidade'],
      fields: [],
      namingTemplate: '{titulo}',
    },
  ];
  const chunks: RetrievedChunk[] = [
    {
      id: 'c1',
      chunkIndex: 0,
      pageNumber: 1,
      text: 'ACORDO DE CONFIDENCIALIDADE entre as partes.',
      score: 10,
      matchedTerms: [],
      reason: 'classification',
    },
  ];

  it('o classificador é obrigado a dizer o tipo antes da pasta', () => {
    const { prompt } = buildCompactClassifierPrompt(chunks, classes);
    assert.ok(prompt.includes('tipoDocumental'));
    assert.ok(prompt.includes('ETAPA 1'));
    assert.ok(prompt.includes('MAIS ESPECÍFICA VENCE'));
    assert.ok(prompt.indexOf('ETAPA 1') < prompt.indexOf('ETAPA 2'));
  });

  it('a segunda opinião recebe de volta o tipo que o primeiro declarou', () => {
    const prompt = buildClassificationReviewPrompt({
      chunks,
      classes,
      firstReason: 'não corresponde a nenhuma das classes definidas',
      documentType: 'ATESTADO MEDICO',
    });
    assert.ok(prompt.includes('ATESTADO MEDICO'));
  });

  it('sem tipo declarado, a segunda opinião não inventa a linha', () => {
    const prompt = buildClassificationReviewPrompt({
      chunks,
      classes,
      firstReason: 'não corresponde a nenhuma das classes definidas',
    });
    assert.ok(!prompt.includes('Ele chegou a identificar'));
  });
});
