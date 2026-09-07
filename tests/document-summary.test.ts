import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { validateMetadataResult } from '../server/ai/utils/validation.js';
import { buildStandardDetailsFields } from '../src/features/document-update-version/utils/documentMetadataDisplay.ts';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.js';

const CLASSE = {
  classId: 'cat_x',
  className: 'Contratos',
  name: 'Contratos',
  description: 'Contratos e acordos.',
  keywords: [],
  fields: [{ key: 'partes_envolvidas', label: 'Partes', type: 'string', required: false }],
  namingTemplate: '{partes_envolvidas}',
} as unknown as DocumentClassRule;

const RESUMO =
  'Acordo de confidencialidade entre Cristiano Baldissera e Sidnei Almeida, celebrado em ' +
  '09/06/2026. Protege informações trocadas na avaliação de uma parceria.';

const responder = (resumo: unknown) => ({
  documentType: 'NDA',
  resumo,
  metadata: { partes_envolvidas: { value: 'Cristiano; Sidnei', confidence: 0.9 } },
  missingFields: [],
  requiresReview: false,
  reviewReasons: [],
});

describe('resumo do documento', () => {
  it('vira campo de metadado, com a chave canônica que a ficha já conhece', () => {
    const result = validateMetadataResult(responder(RESUMO), CLASSE);
    assert.equal(result.summary, RESUMO);
    assert.equal(result.metadata.resumo?.value, RESUMO);
    assert.equal(result.metadata.resumo?.label, 'Resumo');
  });

  it('corta no limite pela fronteira de frase, não no meio da palavra', () => {
    const longo = `${'Contrato de prestação de serviços entre as partes. '.repeat(12)}Fim.`;
    const result = validateMetadataResult(responder(longo), CLASSE);

    assert.ok(result.summary!.length <= 400);
    assert.ok(result.summary!.endsWith('.'), 'termina em fim de frase');
    assert.equal(result.summary!.includes('…'), false);
  });

  it('resposta curta demais ou ausente não vira resumo', () => {
    // "Documento." não descreve nada, e resumo inventado é pior que resumo nenhum.
    for (const ruim of ['Documento.', '', '   ', null, 42, undefined]) {
      const result = validateMetadataResult(responder(ruim), CLASSE);
      assert.equal(result.summary ?? null, null, `"${String(ruim)}" não deveria virar resumo`);
      assert.equal(result.metadata.resumo, undefined);
    }
  });

  it('aparece na ficha do painel Detalhes', () => {
    const fields = buildStandardDetailsFields({
      metadata: { resumo: { label: 'Resumo', value: RESUMO } },
      searchMeta: null,
    });
    assert.equal(fields.find((field) => field.key === 'resumo')?.value, RESUMO);
  });

  it('o extrator pede o resumo e o editor o trata como parágrafo', () => {
    assert.ok(readFileSync('server/ai/utils/extractorPrompt.ts', 'utf8').includes('"resumo"'));
    assert.ok(
      readFileSync('src/features/expiry/components/DocumentExpiryEditor.tsx', 'utf8').includes(
        "LONG_TEXT_KEYS = new Set(['resumo'])",
      ),
    );
  });
});
