import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildQuickFieldRows } from '../src/features/upload/review/quickFieldRows';
import type { CategoryFieldSpec } from '../src/features/documents/api/documentsApi';
import type { ExtractedMetadata } from '../src/features/document-send/types';

function makeMetadata(
  extractedFields: Array<{ key: string; label: string; value: string }>,
): ExtractedMetadata {
  return {
    suggestedName: 'contrato.pdf',
    documentType: 'Contrato',
    suggestedVersion: 'v1.0',
    confidenceScore: 0.9,
    analysisStatus: 'requires_review',
    extractedFields,
  } as ExtractedMetadata;
}

const categoryFields: CategoryFieldSpec[] = [
  { key: 'parte', label: 'Parte contratada', type: 'string', required: true },
  { key: 'vencimento', label: 'Vencimento', type: 'date', required: true },
  { key: 'valor', label: 'Valor', type: 'currency', required: false },
];

describe('formulário rápido da revisão', () => {
  it('segue a ordem da categoria e traz o que a IA preencheu', () => {
    const rows = buildQuickFieldRows({
      categoryFields,
      metadata: makeMetadata([{ key: 'vencimento', label: 'Vencimento', value: '2026-12-31' }]),
      overrides: {},
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      ['parte', 'vencimento', 'valor'],
    );
    assert.equal(rows[1].value, '2026-12-31');
    assert.equal(rows[1].fromAi, true);
    // Campo obrigatório que a IA não preencheu aparece vazio, não some.
    assert.equal(rows[0].value, '');
    assert.equal(rows[0].required, true);
  });

  it('o que a pessoa digitou vence o que a IA extraiu', () => {
    const rows = buildQuickFieldRows({
      categoryFields,
      metadata: makeMetadata([{ key: 'vencimento', label: 'Vencimento', value: '2026-12-31' }]),
      overrides: { vencimento: '2027-01-15' },
    });

    const vencimento = rows.find((row) => row.key === 'vencimento');
    assert.equal(vencimento?.value, '2027-01-15');
    // Deixa de ser valor da IA no instante em que alguém corrige.
    assert.equal(vencimento?.fromAi, false);
  });

  it('campo que a IA trouxe e a regra não prevê continua na tela', () => {
    const rows = buildQuickFieldRows({
      categoryFields,
      metadata: makeMetadata([{ key: 'protocolo', label: 'Protocolo', value: 'ABC-1' }]),
      overrides: {},
    });

    const extra = rows.find((row) => row.key === 'protocolo');
    assert.equal(extra?.value, 'ABC-1');
    assert.equal(extra?.required, false);
    // Vem depois dos campos da regra, que são os que o cliente configurou.
    assert.equal(rows[rows.length - 1].key, 'protocolo');
  });

  it('sem categoria configurada, sobra o que a IA trouxe', () => {
    const rows = buildQuickFieldRows({
      categoryFields: [],
      metadata: makeMetadata([{ key: 'valor', label: 'Valor', value: '1000' }]),
      overrides: {},
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      ['valor'],
    );
  });
});

describe('contrato da correção manual no confirm', () => {
  it('valor corrigido entra com origem manual e confiança cheia', () => {
    const service = readFileSync(
      new URL('../server/services/confirmAnalysisService.ts', import.meta.url),
      'utf8',
    );

    const start = service.indexOf('function applyMetadataOverrides');
    const block = service.slice(start, start + 1200);

    assert.match(block, /source: 'manual'/);
    assert.match(block, /confidence: 1/);
    // O rótulo original é preservado: quem revisou mudou o valor, não o nome do campo.
    assert.match(block, /label: existing\?\.label \?\? key/);
  });

  it('a rota de campos da categoria está registrada no dispatcher', () => {
    const server = readFileSync(
      new URL('../server/apiServer.ts', import.meta.url),
      'utf8',
    );

    // Arquivo em api/ não vira rota sozinho fora da Vercel — precisa estar na tabela.
    assert.match(server, /document-categories\\\/\(\[\^\/\]\+\)\\\/fields/);
    assert.match(server, /paramKeys: \['categoryId'\]/);
  });
});
