import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { refineExtraction } from '../server/ai/services/extractionRefinementLoop.js';
import type { EvaluationResult } from '../server/ai/services/extractionEvaluatorAgent.js';
import type { FocusedExtractionResult } from '../server/ai/services/focusedExtractorAgent.js';
import { createTokenBudget } from '../server/ai/utils/tokenBudget.js';
import type { DocumentAnalysisProvider } from '../server/ai/providers/types.js';
import type {
  ClassificationResult,
  DocumentChunk,
  DocumentClassRule,
  ExtractedMetadataField,
  MetadataExtractionResult,
  RetrievedChunk,
} from '../server/ai/types/documentAi.types.js';

const CLASSE: DocumentClassRule = {
  id: 'cat_fin',
  name: 'Financeiro',
  description: 'Notas e recibos.',
  keywords: ['nota', 'boleto'],
  fields: [
    { key: 'fornecedor', label: 'Fornecedor', type: 'string', required: true },
    { key: 'numero_nota', label: 'Número da nota', type: 'string', required: true },
  ],
  namingTemplate: '{fornecedor}',
};

const CLASSIFICACAO: ClassificationResult = {
  classId: 'cat_fin',
  className: 'Financeiro',
  confidence: 0.95,
  requiresReview: false,
  reason: 'nota fiscal',
  evidence: [],
};

const CHUNK: DocumentChunk = {
  id: 'c1',
  chunkIndex: 0,
  pageNumber: 1,
  text: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda. Nota fiscal 4471.',
};

const RETRIEVED: RetrievedChunk = { ...CHUNK, score: 10, matchedTerms: [], reason: 'extraction' };

function field(value: string | null, snippet?: string): ExtractedMetadataField {
  return {
    label: 'campo',
    value,
    normalizedValue: value,
    confidence: 0.9,
    source: 'document_text',
    ...(snippet ? { evidence: { snippet } } : {}),
  };
}

function providerReturning(extraction: MetadataExtractionResult): DocumentAnalysisProvider {
  return {
    name: 'groq',
    isConfigured: () => true,
    classify: async () => CLASSIFICACAO,
    extractMetadata: async () => extraction,
  };
}

const EXTRACAO_INCOMPLETA: MetadataExtractionResult = {
  documentType: 'Financeiro',
  version: 'v1.0',
  metadata: {
    fornecedor: field('Talha Sul Serviços Industriais Ltda', 'BENEFICIÁRIO: Talha Sul'),
    numero_nota: field(null),
  },
  missingFields: ['numero_nota'],
  requiresReview: true,
  reviewReasons: ['Campo obrigatório ausente.'],
  naming: { tipo: 'NOTA FISCAL', sujeitos: ['Talha Sul'], dataReferencia: null },
};

function evaluationSaying(verdict: 'buscar_de_novo' | 'ausente_de_fato'): EvaluationResult {
  return {
    complete: verdict === 'ausente_de_fato',
    fields: [{ key: 'numero_nota', verdict, hint: 'procure o número fiscal', where: ['nota fiscal'] }],
    usage: { promptTokens: 400, completionTokens: 100, totalTokens: 500 },
    skipped: false,
    triage: {
      findings: [],
      suspectFieldKeys: ['numero_nota'],
      suspectNamingKeys: [],
      errorProneClass: false,
      clean: false,
    },
  };
}

const ENV_KEY = 'EXTRACTION_REFINEMENT_ENABLED';
const previousEnv = process.env[ENV_KEY];

afterEach(() => {
  if (previousEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = previousEnv;
});

const baseInput = {
  chunks: [CHUNK],
  extractionChunks: [RETRIEVED],
  selectedClass: CLASSE,
  classification: CLASSIFICACAO,
  context: { jobId: 'job_test', companyId: 'tenant_test' },
};

function evaluationClearing(key: string, questionado = true): EvaluationResult {
  return {
    complete: true,
    fields: [{ key, verdict: 'ausente_de_fato', reason: 'recibo avulso sem numeração fiscal' }],
    usage: { promptTokens: 400, completionTokens: 100, totalTokens: 500 },
    skipped: false,
    triage: {
      findings: [],
      suspectFieldKeys: questionado ? [key] : [],
      suspectNamingKeys: [],
      errorProneClass: true,
      clean: false,
    },
  };
}

/** Recibo avulso: o extrator preencheu `numero_nota` com a numeração do talão. */
const EXTRACAO_COM_TALAO: MetadataExtractionResult = {
  documentType: 'Financeiro',
  version: 'v1.0',
  metadata: {
    fornecedor: field('Aparecida Simões da Rocha', 'Recebi de'),
    numero_nota: field('0447', 'Nº 0447'),
  },
  missingFields: [],
  requiresReview: false,
  reviewReasons: [],
  naming: { tipo: 'RECIBO', sujeitos: ['Aparecida'], dataReferencia: '2026-02-02' },
};

describe('laço de refino', () => {
  it('desligado, devolve a extração intacta e não chama agente nenhum', async () => {
    delete process.env[ENV_KEY];
    let called = false;

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
      deps: {
        evaluate: async () => {
          called = true;
          return evaluationSaying('buscar_de_novo');
        },
      },
    });

    assert.equal(called, false);
    assert.equal(result.trail.enabled, false);
    assert.equal(result.trail.stopReason, 'desligado');
    assert.deepEqual(result.extraction, EXTRACAO_INCOMPLETA);
  });

  it('recupera o campo que a segunda leitura encontrou e tira o documento da revisão', async () => {
    process.env[ENV_KEY] = 'true';

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
      budget: createTokenBudget(15_000),
      deps: {
        evaluate: async () => evaluationSaying('buscar_de_novo'),
        extractFocused: async (): Promise<FocusedExtractionResult> => ({
          metadata: { numero_nota: field('4471', 'Nota fiscal 4471') },
          usage: { promptTokens: 300, completionTokens: 80, totalTokens: 380 },
        }),
      },
    });

    assert.equal(result.extraction.metadata.numero_nota?.value, '4471');
    assert.deepEqual(result.extraction.missingFields, []);
    assert.equal(result.extraction.requiresReview, false);
    assert.deepEqual(result.trail.recoveredFields, ['numero_nota']);
  });

  it('valor sem trecho que o comprove não substitui nada', async () => {
    process.env[ENV_KEY] = 'true';

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
      budget: createTokenBudget(15_000),
      deps: {
        evaluate: async () => evaluationSaying('buscar_de_novo'),
        extractFocused: async (): Promise<FocusedExtractionResult> => ({
          // Sem evidence: a segunda tentativa inventou sob pressão de encontrar algo.
          metadata: { numero_nota: field('0447') },
          usage: { promptTokens: 300, completionTokens: 80, totalTokens: 380 },
        }),
      },
    });

    assert.equal(result.extraction.metadata.numero_nota?.value, null);
    assert.deepEqual(result.trail.recoveredFields, []);
    assert.equal(result.trail.stopReason, 'sem_progresso');
  });

  it('ausência de fato encerra sem gastar passe focado', async () => {
    process.env[ENV_KEY] = 'true';
    let focusedCalls = 0;

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
      budget: createTokenBudget(15_000),
      deps: {
        evaluate: async () => evaluationSaying('ausente_de_fato'),
        extractFocused: async (): Promise<FocusedExtractionResult> => {
          focusedCalls += 1;
          return { metadata: {}, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
        },
      },
    });

    assert.equal(focusedCalls, 0);
    assert.equal(result.trail.stopReason, 'avaliador_aprovou');
    assert.deepEqual(result.trail.absentFields, ['numero_nota']);
    // Continua faltando: o Avaliador disse que o documento não traz o dado, não que ele apareceu.
    assert.deepEqual(result.extraction.missingFields, ['numero_nota']);
    assert.equal(result.extraction.requiresReview, true);
  });

  it('orçamento apertado corta o laço antes da chamada, não depois', async () => {
    process.env[ENV_KEY] = 'true';
    let focusedCalls = 0;

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
      // Cabe a avaliação (500) e nada além dela.
      budget: createTokenBudget(600),
      deps: {
        evaluate: async () => evaluationSaying('buscar_de_novo'),
        extractFocused: async (): Promise<FocusedExtractionResult> => {
          focusedCalls += 1;
          return { metadata: {}, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
        },
      },
    });

    assert.equal(focusedCalls, 0);
    assert.equal(result.trail.stopReason, 'orcamento_esgotado');
    assert.equal(result.trail.tokenBudget, 600);
  });

  it('apaga o valor que o Avaliador declarou ausente do documento', async () => {
    process.env[ENV_KEY] = 'true';

    // `financeiro_03`: o recibo traz "Nº 0447" impresso no talão e o extrator preenche
    // `numero_nota` com isso. O gabarito diz que o certo é vazio. Antes deste comportamento a
    // conclusão do Avaliador morria no relatório e o 0447 seguia para o banco.
    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_COM_TALAO),
      budget: createTokenBudget(15_000),
      deps: { evaluate: async () => evaluationClearing('numero_nota') },
    });

    assert.equal(result.extraction.metadata.numero_nota, undefined);
    assert.deepEqual(result.trail.clearedFields, ['numero_nota']);
    // Campo obrigatório vazio volta a contar como faltante: a pessoa confirma que não existe.
    assert.deepEqual(result.extraction.missingFields, ['numero_nota']);
  });

  it('não apaga campo que a triagem nunca questionou', async () => {
    process.env[ENV_KEY] = 'true';

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_COM_TALAO),
      budget: createTokenBudget(15_000),
      // O Avaliador se distraiu: declarou ausente um campo que ninguém tinha questionado.
      deps: { evaluate: async () => evaluationClearing('numero_nota', false) },
    });

    assert.equal(result.extraction.metadata.numero_nota?.value, '0447');
    assert.deepEqual(result.trail.clearedFields, []);
  });

  it('leitura parcial não basta para declarar ausência — o campo é reprocurado', async () => {
    process.env[ENV_KEY] = 'true';
    let focusedCalls = 0;

    // O documento tem três chunks; o retriever entregou um. "Não está aqui" só significa "não
    // está nos trechos que me deram" — e o dado estava no chunk que não foi selecionado.
    const result = await refineExtraction({
      ...baseInput,
      chunks: [CHUNK, { ...CHUNK, id: 'c2', chunkIndex: 1 }, { ...CHUNK, id: 'c3', chunkIndex: 2 }],
      extractionChunks: [RETRIEVED],
      analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
      budget: createTokenBudget(15_000),
      deps: {
        evaluate: async () => evaluationSaying('ausente_de_fato'),
        extractFocused: async (): Promise<FocusedExtractionResult> => {
          focusedCalls += 1;
          return {
            metadata: { numero_nota: field('4471', 'Nota fiscal 4471') },
            usage: { promptTokens: 300, completionTokens: 80, totalTokens: 380 },
          };
        },
      },
    });

    assert.equal(focusedCalls, 1, 'a ausência tinha que virar busca');
    assert.equal(result.extraction.metadata.numero_nota?.value, '4471');
    assert.deepEqual(result.trail.recoveredFields, ['numero_nota']);
    // Nunca esteve ausente: o retriever é que não tinha entregue o trecho.
    assert.deepEqual(result.trail.provenAbsentFields, []);
    assert.equal(result.trail.evaluatorSawWholeDocument, false);
  });

  it('reprocurado no documento inteiro e não achado, a ausência fica provada', async () => {
    process.env[ENV_KEY] = 'true';

    const result = await refineExtraction({
      ...baseInput,
      chunks: [CHUNK, { ...CHUNK, id: 'c2', chunkIndex: 1 }],
      extractionChunks: [RETRIEVED],
      analysisProvider: providerReturning(EXTRACAO_COM_TALAO),
      budget: createTokenBudget(15_000),
      deps: {
        evaluate: async () => evaluationClearing('numero_nota'),
        extractFocused: async (): Promise<FocusedExtractionResult> => ({
          metadata: {},
          usage: { promptTokens: 300, completionTokens: 80, totalTokens: 380 },
        }),
      },
    });

    assert.deepEqual(result.trail.provenAbsentFields, ['numero_nota']);
    assert.equal(result.trail.stopReason, 'ausencia_provada');
    // Só agora o valor do talão sai: antes da prova, apagar seria confiar numa leitura parcial.
    assert.deepEqual(result.trail.clearedFields, ['numero_nota']);
    assert.equal(result.extraction.metadata.numero_nota, undefined);
  });

  it('quando a seleção já era o documento inteiro, a prova não custa chamada', async () => {
    process.env[ENV_KEY] = 'true';
    let focusedCalls = 0;

    const result = await refineExtraction({
      ...baseInput,
      analysisProvider: providerReturning(EXTRACAO_COM_TALAO),
      budget: createTokenBudget(15_000),
      deps: {
        evaluate: async () => evaluationClearing('numero_nota'),
        extractFocused: async (): Promise<FocusedExtractionResult> => {
          focusedCalls += 1;
          return { metadata: {}, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
        },
      },
    });

    assert.equal(result.trail.evaluatorSawWholeDocument, true);
    assert.equal(focusedCalls, 0);
    assert.deepEqual(result.trail.provenAbsentFields, ['numero_nota']);
    assert.deepEqual(result.trail.clearedFields, ['numero_nota']);
  });

  it('respeita o teto de passes mesmo quando cada passe recupera algo', async () => {
    process.env[ENV_KEY] = 'true';
    process.env.EXTRACTION_REFINEMENT_MAX_PASSES = '2';
    let focusedCalls = 0;

    try {
      const result = await refineExtraction({
        ...baseInput,
        analysisProvider: providerReturning(EXTRACAO_INCOMPLETA),
        budget: createTokenBudget(15_000),
        deps: {
          evaluate: async () => evaluationSaying('buscar_de_novo'),
          extractFocused: async (): Promise<FocusedExtractionResult> => {
            focusedCalls += 1;
            return {
              metadata: { numero_nota: field(`447${focusedCalls}`, 'Nota fiscal 4471') },
              usage: { promptTokens: 300, completionTokens: 80, totalTokens: 380 },
            };
          },
        },
      });

      assert.equal(focusedCalls, 2);
      assert.equal(result.trail.passes.length, 2);
      assert.equal(result.trail.stopReason, 'teto_de_passes');
    } finally {
      delete process.env.EXTRACTION_REFINEMENT_MAX_PASSES;
    }
  });
});
