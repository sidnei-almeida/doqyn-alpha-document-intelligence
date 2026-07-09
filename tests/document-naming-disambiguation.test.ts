import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { generateRecommendedFileName } from '../server/ai/services/documentNaming.js';
import { enrichMetadataWithPartyHeuristics } from '../server/ai/utils/partyMetadataHeuristics.js';
import { isValidPartyName } from '../server/ai/utils/partyNameValidation.js';
import type { DocumentClassRule, ExtractedMetadataField } from '../server/ai/types/documentAi.types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function readServer(relativePath: string): string {
  return readFileSync(join(repoRoot, 'server', relativePath), 'utf8');
}

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function field(key: string, value: string): ExtractedMetadataField {
  return {
    key,
    label: key,
    value,
    normalizedValue: value,
    confidence: 0.95,
  };
}

const ndaClass: DocumentClassRule = {
  id: 'class_nda',
  name: 'Acordo de Confidencialidade',
  description: 'NDA',
  keywords: ['nda', 'confidencialidade'],
  fields: [],
  namingTemplate: 'juridico_{titulo}',
};

describe('nomenclatura inteligente de documentos', () => {
  it('substitui título jurídico genérico por partes identificáveis', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'nda.pdf',
      selectedClass: ndaClass,
      metadata: {
        titulo: field(
          'titulo',
          'ACORDO DE CONFIDENCIALIDADE NAO CONCORRENCIA NAO ALICIAMENTO E PROTECAO DE INFORMACOES NDA',
        ),
        parte_reveladora: field('parte_reveladora', 'Sidnei Almeida'),
        parte_receptora: field('parte_receptora', 'Pedro Souza'),
        data_assinatura: field('data_assinatura', '2024-03-15'),
      },
      version: 'v1',
    });

    assert.match(result, /NDA/i);
    assert.match(result, /Sidnei_Almeida/i);
    assert.match(result, /Pedro_Souza/i);
    assert.equal(result.includes('juridico_'), false);
    assert.equal(result.includes('ACORDO_DE_CONFIDENCIALIDADE'), false);
  });

  it('remove prefixo de categoria do slug no nome final', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'doc.pdf',
      selectedClass: {
        ...ndaClass,
        namingTemplate: 'financeiro_{fornecedor}_{numero_nota}',
      },
      metadata: {
        fornecedor: field('fornecedor', 'Acme Ltda'),
        numero_nota: field('numero_nota', '12345'),
      },
      version: 'v1',
    });

    assert.match(result, /Acme/i);
    assert.equal(result.toLowerCase().startsWith('financeiro_'), false);
  });

  it('usa template NDA com ambas as partes quando disponíveis', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'nda.pdf',
      selectedClass: {
        ...ndaClass,
        namingTemplate: 'NDA_{parte_reveladora}_e_{parte_receptora}_{data_assinatura}_v{version}',
      },
      metadata: {
        parte_reveladora: field('parte_reveladora', 'Paulão Comércio Ltda'),
        parte_receptora: field('parte_receptora', 'Cliente Beta SA'),
        data_assinatura: field('data_assinatura', '2025-01-10'),
      },
      version: 'v1',
    });

    assert.match(result, /Paulao_Comercio/i);
    assert.match(result, /Cliente_Beta/i);
    assert.match(result, /_e_/i);
  });

  it('não gera apenas NDA.pdf quando partes não foram extraídas pela IA', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'nda.pdf',
      selectedClass: ndaClass,
      metadata: {
        titulo: field(
          'titulo',
          'ACORDO DE CONFIDENCIALIDADE NAO CONCORRENCIA NAO ALICIAMENTO',
        ),
      },
      version: 'v1',
    });

    assert.notEqual(result.toLowerCase(), 'nda.pdf');
    assert.ok(result.length > 'NDA.pdf'.length);
  });

  it('heurística extrai partes do texto quando metadados vazios', () => {
    const chunk = {
      id: 'c1',
      chunkIndex: 0,
      text: 'De um lado, Sidnei Almeida, e de outro, Pedro Souza, firmam o presente acordo.',
      score: 1,
      matchedTerms: [],
      reason: 'test',
    };

    const enriched = enrichMetadataWithPartyHeuristics({
      chunks: [chunk],
      selectedClass: ndaClass,
      metadata: {},
    });

    assert.match(String(enriched.parte_reveladora?.value), /Sidnei/i);
    assert.match(String(enriched.parte_receptora?.value), /Pedro/i);

    const result = generateRecommendedFileName({
      originalFileName: 'nda.pdf',
      selectedClass: ndaClass,
      metadata: enriched,
      version: 'v1',
      sourceChunks: [chunk],
    });

    assert.match(result, /Sidnei/i);
    assert.match(result, /Pedro/i);
    assert.notEqual(result.toLowerCase(), 'nda.pdf');
  });

  it('rejeita fragmento jurídico "ao RECEPTOR no contexto de negociações"', () => {
    const bad = 'ao RECEPTOR no contexto de negociacoes e no contexto de negociacoes';
    assert.equal(isValidPartyName(bad), false);

    const result = generateRecommendedFileName({
      originalFileName: 'nda.pdf',
      selectedClass: {
        ...ndaClass,
        namingTemplate: 'NDA_{parte_reveladora}_e_{parte_receptora}_{data_assinatura}_v{version}',
      },
      metadata: {
        parte_receptora: field('parte_receptora', bad),
      },
      version: 'v1',
    });

    assert.equal(result.toLowerCase().includes('contexto_de_negociacoes'), false);
    assert.equal(result.toLowerCase().includes('ao_receptor'), false);
    assert.match(result, /SemPartesIdentificadas/i);
    assert.notEqual(result.toLowerCase(), 'nda.pdf');
  });

  it('não usa nome de arquivo original com título jurídico genérico como fallback', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'NDA - ACORDO DE CONFIDENCIALIDADE.pdf',
      selectedClass: ndaClass,
      metadata: {},
      version: 'v1',
    });

    assert.equal(result.toLowerCase().includes('acordo_de_confidencialidade'), false);
    assert.match(result, /SemPartesIdentificadas/i);
  });
});

describe('performance do pipeline RAG', () => {
  it('analyze carrega regras em paralelo com extração de texto', () => {
    const analyze = readServer('ai/services/analyzePdfService.ts');
    assert.ok(analyze.includes('rulesLoadPromise'));
    assert.ok(analyze.includes('loadActiveDocumentClassRules'));
    assert.ok(analyze.includes('await rulesLoadPromise'));
  });

  it('extrator usa prompt enriquecido com campos de partes para NDA', () => {
    const extractor = readServer('ai/services/metadataExtractorAgent.ts');
    const prompt = readServer('ai/utils/extractorPrompt.ts');
    const analyze = readServer('ai/services/analyzePdfService.ts');
    const heuristics = readServer('ai/utils/documentClassHeuristics.ts');
    assert.ok(extractor.includes('buildCompactExtractorPrompt'));
    assert.ok(prompt.includes('MAX_EXTRACTOR_FIELDS_IN_PROMPT'));
    assert.ok(prompt.includes('PARTE REVELADORA'));
    assert.ok(prompt.includes('de um lado'));
    assert.ok(prompt.includes('description'));
    assert.ok(analyze.includes('augmentConfidentialityClassForExtraction'));
    assert.ok(heuristics.includes('CONFIDENTIALITY_PARTY_FIELDS'));
    assert.equal(extractor.includes('JSON.stringify(selectedClass, null, 2)'), false);
  });

  it('regras documentais usam cache em memória', () => {
    const rules = readServer('services/documentRulesService.ts');
    assert.ok(rules.includes('RULES_CACHE_TTL_MS'));
    assert.ok(rules.includes('rulesCache.set'));
  });

  it('governança seed não usa slug da categoria no namingTemplate jurídico', () => {
    const seed = readRepo('server/db/seed/documentGovernanceSeed.ts');
    assert.ok(seed.includes("category.slug === 'juridico'"));
    assert.ok(seed.includes('parte_reveladora'));
    assert.equal(seed.includes('`${category.slug}_{titulo}`'), false);
  });
});
