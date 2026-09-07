import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
} from '../server/ai/types/documentAi.types.js';

const CLASSE: DocumentClassRule = {
  id: 'cat_fin',
  name: 'Financeiro',
  description: 'Notas e recibos.',
  keywords: ['nota'],
  fields: [
    {
      key: 'numero_nota',
      label: 'Número da nota',
      type: 'string',
      required: true,
      aliases: ['nota fiscal', 'danfe'],
    },
  ],
  namingTemplate: '{numero_nota}',
};

const CLASSIFICACAO: ClassificationResult = {
  classId: 'cat_fin',
  className: 'Financeiro',
  confidence: 0.95,
  requiresReview: false,
  reason: 'nota',
  evidence: [],
};

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

/** Nenhum chunk menciona nota, danfe ou número: a busca por este campo não tem onde se ancorar. */
const SEM_ANCORA: DocumentChunk[] = [
  { id: 'c1', chunkIndex: 0, pageNumber: 1, text: 'Relatório mensal de atividades da equipe.' },
  { id: 'c2', chunkIndex: 1, pageNumber: 2, text: 'Considerações finais sobre o período.' },
  { id: 'c3', chunkIndex: 2, pageNumber: 3, text: 'Anexo com fotografias da obra.' },
];

const EXTRACAO: MetadataExtractionResult = {
  documentType: 'Financeiro',
  version: 'v1.0',
  metadata: { numero_nota: field('0447', 'Nº 0447') },
  missingFields: [],
  requiresReview: false,
  reviewReasons: [],
};

function avaliadorDizAusente(): EvaluationResult {
  return {
    complete: true,
    fields: [{ key: 'numero_nota', verdict: 'ausente_de_fato', reason: 'não vi nota fiscal' }],
    usage: { promptTokens: 400, completionTokens: 100, totalTokens: 500 },
    skipped: false,
    // O fake entrega um trecho, e é o documento inteiro nos casos curtos destes testes.
    promptChunkCount: 1,
    triage: {
      findings: [],
      suspectFieldKeys: ['numero_nota'],
      suspectNamingKeys: [],
      errorProneClass: true,
      clean: false,
    },
  };
}

const ENV_KEY = 'EXTRACTION_REFINEMENT_ENABLED';
const previousEnv = process.env[ENV_KEY];

describe('prova de ausência não se apoia em busca sem âncora', () => {
  it('sem trecho que pontue, a ausência fica sem prova e o documento vai para revisão', async () => {
    process.env[ENV_KEY] = 'true';
    let focusedCalls = 0;

    try {
      // O retriever devolve os primeiros trechos quando nada pontua. Aceitar isso como prova seria
      // ler a página 1 e concluir sobre o documento inteiro — o mesmo exagero que a prova corrige.
      const result = await refineExtraction({
        chunks: SEM_ANCORA,
        extractionChunks: [
          { ...SEM_ANCORA[0], score: 5, matchedTerms: [], reason: 'extraction' },
        ],
        selectedClass: CLASSE,
        classification: CLASSIFICACAO,
        context: { jobId: 'job_test', companyId: 'tenant_test' },
        analysisProvider: {
          name: 'groq',
          isConfigured: () => true,
          classify: async () => CLASSIFICACAO,
          extractMetadata: async () => EXTRACAO,
        } satisfies DocumentAnalysisProvider,
        budget: createTokenBudget(15_000),
        deps: {
          evaluate: async () => avaliadorDizAusente(),
          extractFocused: async (): Promise<FocusedExtractionResult> => {
            focusedCalls += 1;
            return { metadata: {}, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
          },
        },
      });

      assert.equal(focusedCalls, 0, 'não há o que perguntar sem trecho ancorado');
      assert.deepEqual(result.trail.unprovableAbsentFields, ['numero_nota']);
      assert.deepEqual(result.trail.provenAbsentFields, []);
      // Não sabe: nem apaga o valor nem afirma que ele está certo. Olho humano decide.
      assert.deepEqual(result.trail.clearedFields, []);
      assert.equal(result.extraction.requiresReview, true);
    } finally {
      if (previousEnv === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = previousEnv;
    }
  });
});

describe('orçamento do refino: freio antes da maior chamada', () => {
  const CLASSE_LONGA: DocumentClassRule = {
    id: 'cat_contratos',
    name: 'Contratos',
    description: 'Contratos.',
    keywords: ['contrato'],
    fields: [
      { key: 'fornecedor', label: 'Fornecedor', type: 'string', required: true },
      { key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: true },
    ],
    namingTemplate: '{fornecedor}',
  };

  /** Documento longo: quarenta trechos de 1.800 caracteres, como o extrator recebe no teto. */
  const CHUNKS_LONGOS: DocumentChunk[] = Array.from({ length: 40 }, (_, index) => ({
    id: `c${index}`,
    chunkIndex: index,
    pageNumber: index + 1,
    text: 'contrato '.repeat(200),
  }));

  it('avaliação que não cabe no orçamento não é feita', async () => {
    process.env[ENV_KEY] = 'true';
    let evaluateCalls = 0;

    try {
      const result = await refineExtraction({
        chunks: CHUNKS_LONGOS,
        extractionChunks: CHUNKS_LONGOS.map((chunk) => ({
          ...chunk,
          score: 5,
          matchedTerms: [],
          reason: 'extraction',
        })),
        selectedClass: CLASSE_LONGA,
        classification: CLASSIFICACAO,
        context: { jobId: 'job_test', companyId: 'tenant_test' },
        analysisProvider: {
          name: 'groq',
          isConfigured: () => true,
          classify: async () => CLASSIFICACAO,
          extractMetadata: async () => EXTRACAO,
        } satisfies DocumentAnalysisProvider,
        // Orçamento pequeno: nem a avaliação cabe.
        budget: createTokenBudget(500),
        deps: {
          evaluate: async () => {
            evaluateCalls += 1;
            return avaliadorDizAusente();
          },
        },
      });

      // O freio existia só para o passe focado; o Avaliador, que é a chamada mais cara, gastava
      // primeiro e debitava depois. Num documento longo isso estourava o teto sozinho.
      assert.equal(evaluateCalls, 0);
      assert.equal(result.trail.stopReason, 'orcamento_esgotado');
    } finally {
      if (previousEnv === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = previousEnv;
    }
  });
});
