import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  compareDocumentVersions,
  buildMetadataSummary,
} from '../server/ai/utils/versionComparison.js';
import {
  buildRagChunkFilter,
  mapDocumentChunksToMongo,
} from '../server/services/documentChunkService.js';
import { buildUpdateExtractorPrompt } from '../server/ai/utils/updateExtractorPrompt.js';
import type { DocumentChunk } from '../server/ai/types/documentAi.types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('versionComparison', () => {
  it('detecta campos alterados, adicionados e removidos', () => {
    const result = compareDocumentVersions({
      oldMetadata: {
        parte_reveladora: {
          label: 'Reveladora',
          value: 'Empresa A',
          normalizedValue: 'Empresa A',
          confidence: 0.9,
          source: 'ai',
        },
        valor_total: {
          label: 'Valor',
          value: 1000,
          normalizedValue: 1000,
          confidence: 0.8,
          source: 'ai',
        },
      },
      newMetadata: {
        parte_reveladora: {
          label: 'Reveladora',
          value: 'Empresa B',
          normalizedValue: 'Empresa B',
          confidence: 0.9,
          source: 'ai',
        },
        objeto: {
          label: 'Objeto',
          value: 'Prestação de serviços',
          normalizedValue: 'Prestação de serviços',
          confidence: 0.8,
          source: 'ai',
        },
      },
      oldCategory: 'Contrato',
      newCategory: 'Contrato',
    });

    assert.ok(result.changedFields.includes('parte_reveladora'));
    assert.ok(result.removedFields.includes('valor_total'));
    assert.ok(result.addedFields.includes('objeto'));
    assert.ok(result.mainChanges.length > 0);
  });

  it('reduz sameDocumentConfidence quando partes mudam muito', () => {
    const result = compareDocumentVersions({
      oldMetadata: {
        parte_reveladora: {
          label: 'A',
          value: 'Alpha Ltda',
          confidence: 1,
          source: 'ai',
        },
        parte_receptora: {
          label: 'B',
          value: 'Beta Ltda',
          confidence: 1,
          source: 'ai',
        },
      },
      newMetadata: {
        parte_reveladora: {
          label: 'A',
          value: 'Gamma Ltda',
          confidence: 1,
          source: 'ai',
        },
        parte_receptora: {
          label: 'B',
          value: 'Delta Ltda',
          confidence: 1,
          source: 'ai',
        },
      },
      oldCategory: 'NDA',
      newCategory: 'Nota Fiscal',
    });

    assert.ok(result.sameDocumentConfidence < 0.55);
    assert.ok(result.riskWarnings.some((w) => w.includes('diferente')));
  });

  it('buildMetadataSummary monta resumo legível', () => {
    const summary = buildMetadataSummary(
      {
        fornecedor: {
          label: 'Fornecedor',
          value: 'ACME',
          confidence: 1,
          source: 'ai',
        },
      },
      'Contrato',
    );
    assert.match(summary, /Contrato/);
    assert.match(summary, /ACME/);
  });
});

describe('documentChunkService', () => {
  it('mapeia chunks com versionId, versionLabel e isCurrentVersion', () => {
    const chunks: DocumentChunk[] = [
      {
        id: 'page_1_chunk_1',
        pageNumber: 1,
        chunkIndex: 1,
        text: 'Trecho de teste',
      },
    ];

    const records = mapDocumentChunksToMongo({
      chunks,
      tenantFields: {
        tenantId: 'tenant_1',
        companyId: 'tenant_1',
        ownerUserId: 'user_1',
      },
      documentId: 'doc_1',
      versionId: 'ver_v1',
      versionLabel: 'v1.0',
      categoryId: 'class_1',
      isCurrentVersion: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    assert.equal(records.length, 1);
    assert.equal(records[0]?.documentId, 'doc_1');
    assert.equal(records[0]?.versionId, 'ver_v1');
    assert.equal(records[0]?.versionLabel, 'v1.0');
    assert.equal(records[0]?.isCurrentVersion, true);
    assert.equal(records[0]?.categoryId, 'class_1');
    assert.equal(records[0]?.chunkIndex, 1);
    assert.equal(records[0]?.embedding, null);
  });

  it('filtro RAG padrão usa isCurrentVersion=true', () => {
    const filter = buildRagChunkFilter({
      ctx: {
        tenantId: 'tenant_1',
        userId: 'user_1',
        storage: {
          tenantId: 'tenant_1',
          tenantType: 'business',
          storageMode: 'shared_collections',
          collectionPrefix: 'company_dev',
          collections: {
            documents: 'documents_company_dev',
            documentVersions: 'document_versions_company_dev',
            documentChunks: 'document_chunks_company_dev',
            processingJobs: 'processing_jobs_company_dev',
            auditLogs: 'audit_logs_company_dev',
          },
        },
        storageScope: {} as never,
        collections: {} as never,
      },
      documentId: 'doc_abc',
      currentOnly: true,
    });

    assert.equal(filter.documentId, 'doc_abc');
    assert.equal(filter.isCurrentVersion, true);
  });

  it('filtro RAG histórico usa versionId específico sem isCurrentVersion', () => {
    const filter = buildRagChunkFilter({
      ctx: {
        tenantId: 'tenant_1',
        userId: 'user_1',
        storage: {
          tenantId: 'tenant_1',
          tenantType: 'business',
          storageMode: 'shared_collections',
          collectionPrefix: 'company_dev',
          collections: {
            documents: 'documents_company_dev',
            documentVersions: 'document_versions_company_dev',
            documentChunks: 'document_chunks_company_dev',
            processingJobs: 'processing_jobs_company_dev',
            auditLogs: 'audit_logs_company_dev',
          },
        },
        storageScope: {} as never,
        collections: {} as never,
      },
      documentId: 'doc_abc',
      versionId: 'ver_old',
      currentOnly: false,
    });

    assert.equal(filter.versionId, 'ver_old');
    assert.equal(filter.isCurrentVersion, undefined);
  });
});

describe('updateExtractorPrompt', () => {
  it('inclui contexto da versão anterior e próxima versão esperada', () => {
    const { prompt } = buildUpdateExtractorPrompt({
      chunks: [
        {
          id: 'c1',
          chunkIndex: 1,
          pageNumber: 1,
          text: 'Novo conteúdo do contrato',
          score: 1,
          matchedTerms: [],
          reason: 'teste',
        },
      ],
      selectedClass: {
        id: 'class_1',
        name: 'Contrato',
        description: 'Contratos comerciais',
        keywords: ['contrato'],
        fields: [
          {
            key: 'parte_reveladora',
            label: 'Parte reveladora',
            type: 'string',
            required: true,
          },
        ],
        namingTemplate: '{class}_{parte}',
      },
      previousVersion: {
        documentId: 'doc_123',
        currentVersionLabel: 'v1.0',
        expectedNextVersionLabel: 'v2.0',
        documentName: 'Contrato ACME.pdf',
        categoryName: 'Contrato',
        metadataSummary: 'Categoria: Contrato | Parte: ACME',
        metadataPreview: { parte_reveladora: 'ACME' },
      },
    });

    assert.match(prompt, /doc_123/);
    assert.match(prompt, /v1\.0/);
    assert.match(prompt, /v2\.0/);
    assert.match(prompt, /Contrato ACME/);
    assert.match(prompt, /seemsSameDocument/);
    assert.match(prompt, /NOVA VERSÃO/);
  });
});

describe('integração version-aware RAG — wiring', () => {
  it('confirmAnalysis persiste chunks após confirmação inicial', () => {
    const source = read('server/services/confirmAnalysisService.ts');
    assert.ok(source.includes('persistChunksAfterVersionConfirm'));
    assert.ok(source.includes('isCurrentVersion: true'));
  });

  it('confirmUpdate persiste chunks sem apagar histórico', () => {
    const confirmUpdate = read('server/services/confirmUpdateDocumentVersionService.ts');
    const chunkService = read('server/services/documentChunkService.ts');
    assert.ok(confirmUpdate.includes('persistChunksAfterVersionConfirm'));
    assert.ok(chunkService.includes('isCurrentVersion: false'));
    assert.ok(chunkService.includes('insertMany'));
    assert.equal(chunkService.includes('deleteMany'), false);
  });

  it('analyze-pdf-update carrega contexto anterior e usa prompt dedicado', () => {
    const endpoint = read('api/ai/analyze-pdf-update.ts');
    const service = read('server/ai/services/analyzePdfUpdateService.ts');
    const agent = read('server/ai/services/metadataUpdateExtractorAgent.ts');
    assert.ok(endpoint.includes('analyzePdfUpdateBuffer'));
    assert.ok(endpoint.includes('documentId'));
    assert.ok(service.includes('loadPreviousVersionContext'));
    assert.ok(service.includes('extractMetadataForVersionUpdate'));
    assert.ok(agent.includes('buildUpdateExtractorPrompt'));
    assert.ok(agent.includes('seemsSameDocument'));
  });

  it('frontend usa analyze-pdf-update em modo atualização', () => {
    const analyze = read('src/features/document-send/services/analyzePdf.ts');
    const page = read('src/features/document-send/DocumentSendPage.tsx');
    assert.ok(analyze.includes('/api/ai/analyze-pdf-update'));
    assert.ok(analyze.includes('documentId'));
    assert.ok(page.includes('documentId: updateTargetDocumentId'));
  });

  it('RAG query API suporta versão atual, histórica e comparação', () => {
    const api = read('api/documents/rag-query.ts');
    const service = read('server/services/documentRagQueryService.ts');
    assert.ok(api.includes('queryDocumentRag'));
    assert.ok(api.includes('answerWhatChanged'));
    assert.ok(service.includes("mode === 'compare'"));
    assert.ok(service.includes('currentOnly: true'));
  });

  it('coleção document_chunks registrada com índices de versão', () => {
    const constants = read('server/db/constants.ts');
    const types = read('server/db/types.ts');
    const indexes = read('server/db/tenantIndexes.ts');
    assert.ok(constants.includes("documentChunks: 'document_chunks'"));
    assert.ok(types.includes('MongoDocumentChunk'));
    assert.ok(types.includes('isCurrentVersion'));
    assert.ok(indexes.includes('isCurrentVersion'));
  });

  it('favorites e listDocuments permanecem por documentId', () => {
    const favorites = read('server/services/favorites/documentFavoritesService.ts');
    const listItems = read('server/services/documentListItems.ts');
    assert.ok(favorites.includes('documentId'));
    assert.ok(listItems.includes('currentVersionId'));
  });
});

describe('fluxo de versões — labels', () => {
  it('upload inicial usa v1.0 e update incrementa major', async () => {
    const { nextMajorVersionLabel, normalizeVersionLabel } = await import(
      '../server/utils/versionLabelUtils.js'
    );
    assert.equal(normalizeVersionLabel('v1'), 'v1.0');
    assert.equal(nextMajorVersionLabel('v1.0'), 'v2.0');
    assert.equal(nextMajorVersionLabel('v2.0'), 'v3.0');
  });
});
