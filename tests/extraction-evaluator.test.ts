import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveComplete,
  evaluateExtraction,
  parseVerdicts,
} from '../server/ai/services/extractionEvaluatorAgent.js';
import type {
  DocumentClassRule,
  RetrievedChunk,
} from '../server/ai/types/documentAi.types.js';

const CLASSE: DocumentClassRule = {
  id: 'cat_fin',
  name: 'Financeiro',
  description: 'Notas e recibos.',
  keywords: ['nota'],
  fields: [
    { key: 'fornecedor', label: 'Fornecedor', type: 'string', required: true },
    { key: 'observacao', label: 'Observação', type: 'string', required: false },
  ],
  namingTemplate: '{fornecedor}',
};

const TRECHO: RetrievedChunk = {
  id: 'c1',
  chunkIndex: 0,
  pageNumber: 1,
  text: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda. Emitido em 05/05/2026.',
  score: 10,
  matchedTerms: [],
  reason: 'extraction',
};

describe('leitura do veredito do modelo', () => {
  it('descarta entrada sem chave ou com veredito desconhecido', () => {
    const verdicts = parseVerdicts({
      fields: [
        { key: 'fornecedor', verdict: 'ok' },
        { key: '', verdict: 'ok' },
        { key: 'numero_nota', verdict: 'talvez' },
        { verdict: 'ok' },
        'lixo',
      ],
    });

    assert.deepEqual(verdicts, [{ key: 'fornecedor', verdict: 'ok', reason: undefined, hint: undefined, where: undefined }]);
  });

  it('preserva dica e termos de busca, limitando a lista', () => {
    const [verdict] = parseVerdicts({
      fields: [
        {
          key: 'fornecedor',
          verdict: 'valor_errado',
          reason: 'pegou o banco',
          hint: 'procure o beneficiário',
          where: ['beneficiário', 'cedente', '', 'a', 'b', 'c', 'd', 'e', 'f', 'g'],
        },
      ],
    });

    assert.equal(verdict.hint, 'procure o beneficiário');
    assert.equal(verdict.where?.length, 8);
    assert.equal(verdict.where?.[0], 'beneficiário');
  });

  it('resposta que não é objeto vira lista vazia', () => {
    assert.deepEqual(parseVerdicts(null), []);
    assert.deepEqual(parseVerdicts('texto'), []);
    assert.deepEqual(parseVerdicts({ fields: 'nao é lista' }), []);
  });
});

describe('conclusão derivada dos vereditos', () => {
  it('campo obrigatório em busca impede a conclusão', () => {
    assert.equal(
      deriveComplete({
        selectedClass: CLASSE,
        verdicts: [{ key: 'fornecedor', verdict: 'buscar_de_novo' }],
      }),
      false,
    );
  });

  it('campo opcional em busca não impede', () => {
    assert.equal(
      deriveComplete({
        selectedClass: CLASSE,
        verdicts: [{ key: 'observacao', verdict: 'buscar_de_novo' }],
      }),
      true,
    );
  });

  it('ausência de fato encerra o assunto, não bloqueia', () => {
    assert.equal(
      deriveComplete({
        selectedClass: CLASSE,
        verdicts: [{ key: 'fornecedor', verdict: 'ausente_de_fato' }],
      }),
      true,
    );
  });

  it('papel de nomeação em busca bloqueia como se fosse obrigatório', () => {
    assert.equal(
      deriveComplete({
        selectedClass: CLASSE,
        verdicts: [{ key: 'naming.sujeitos', verdict: 'buscar_de_novo' }],
      }),
      false,
    );
  });
});

describe('atalho da triagem limpa', () => {
  it('documento sem sintoma não chega ao modelo e não gasta token', async () => {
    // Sem GROQ_API_KEY no ambiente de teste, qualquer chamada real explodiria. Passar aqui é a
    // prova de que o atalho existe: triagem limpa devolve antes de tocar no provedor.
    const result = await evaluateExtraction({
      selectedClass: CLASSE,
      chunks: [TRECHO],
      naming: {
        tipo: 'NOTA FISCAL',
        sujeitos: ['Talha Sul Serviços Industriais Ltda'],
        dataReferencia: '2026-05-05',
      },
      metadata: {
        fornecedor: {
          label: 'Fornecedor',
          value: 'Talha Sul Serviços Industriais Ltda',
          confidence: 0.94,
          source: 'document_text',
          evidence: { snippet: 'BENEFICIÁRIO: Talha Sul Serviços Industriais Ltda' },
        },
      },
    });

    assert.equal(result.skipped, true);
    assert.equal(result.complete, true);
    assert.equal(result.usage.totalTokens, 0);
  });
});
