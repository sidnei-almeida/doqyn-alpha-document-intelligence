import type { DocumentClassRule } from '../ai/types/documentAi.types.js';
import {
  mongoChunksToDocumentChunks,
  queryDocumentChunksForRag,
  type RagChunkQueryInput,
} from './documentChunkService.js';
import {
  compareDocumentVersions,
  buildMetadataSummary,
  type VersionComparisonResult,
} from '../ai/utils/versionComparison.js';
import { selectChunksForExtraction } from './retrievalProvider.js';
import type { MongoDocumentVersion } from '../db/types.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';

export type DocumentRagQueryMode = 'current' | 'version' | 'compare' | 'what_changed';

export type DocumentRagQueryInput = RagChunkQueryInput & {
  mode?: DocumentRagQueryMode;
  compareVersionId?: string;
  compareVersionLabel?: string;
  selectedClass?: DocumentClassRule;
  topK?: number;
};

export type DocumentRagQueryResponse = {
  documentId: string;
  mode: DocumentRagQueryMode;
  versionId?: string;
  versionLabel?: string;
  chunkCount: number;
  chunks: Array<{
    chunkIndex: number;
    versionId: string;
    versionLabel: string;
    isCurrentVersion: boolean;
    pageNumber?: number;
    textPreview: string;
    score?: number;
  }>;
  versionComparison?: VersionComparisonResult;
  whatChangedSummary?: string[];
};

function previewText(text: string, max = 240): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function loadVersionRecord(input: {
  ctx: RagChunkQueryInput['ctx'];
  documentId: string;
  versionId?: string;
  versionLabel?: string;
}): Promise<MongoDocumentVersion | null> {
  const filter: Record<string, unknown> = {
    documentId: input.documentId,
    ...tenantScopeFilterFromContext(input.ctx.storage),
  };

  if (input.versionId) {
    filter._id = input.versionId;
  } else if (input.versionLabel) {
    filter.versionLabel = input.versionLabel;
  } else {
    return null;
  }

  const version = await input.ctx.collections.documentVersions.findOne(filter);
  return (version as MongoDocumentVersion | null) ?? null;
}

export async function queryDocumentRag(input: DocumentRagQueryInput): Promise<DocumentRagQueryResponse> {
  const mode = input.mode ?? (input.compareVersionId || input.compareVersionLabel ? 'compare' : input.currentOnly === false ? 'version' : 'current');

  if (mode === 'compare') {
    const currentResult = await queryDocumentChunksForRag({
      ctx: input.ctx,
      documentId: input.documentId,
      currentOnly: true,
    });

    const compareResult = await queryDocumentChunksForRag({
      ctx: input.ctx,
      documentId: input.documentId,
      versionId: input.compareVersionId,
      versionLabel: input.compareVersionLabel,
      currentOnly: false,
    });

    const currentVersion = await loadVersionRecord({
      ctx: input.ctx,
      documentId: input.documentId,
      versionId: currentResult.chunks[0]?.versionId,
    });
    const previousVersion = await loadVersionRecord({
      ctx: input.ctx,
      documentId: input.documentId,
      versionId: input.compareVersionId,
      versionLabel: input.compareVersionLabel,
    });

    const versionComparison =
      currentVersion && previousVersion
        ? compareDocumentVersions({
            oldMetadata: previousVersion.metadata ?? {},
            newMetadata: currentVersion.metadata ?? {},
            oldCategory: previousVersion.classification?.className,
            newCategory: currentVersion.classification?.className,
            oldSummary: buildMetadataSummary(previousVersion.metadata ?? {}, previousVersion.classification?.className),
            newSummary: buildMetadataSummary(currentVersion.metadata ?? {}, currentVersion.classification?.className),
          })
        : undefined;

    return {
      documentId: input.documentId,
      mode: 'compare',
      versionId: currentResult.chunks[0]?.versionId,
      versionLabel: currentResult.chunks[0]?.versionLabel,
      chunkCount: currentResult.chunks.length + compareResult.chunks.length,
      chunks: [
        ...currentResult.chunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          versionId: chunk.versionId,
          versionLabel: chunk.versionLabel,
          isCurrentVersion: chunk.isCurrentVersion,
          pageNumber: chunk.pageNumber,
          textPreview: previewText(chunk.text),
        })),
        ...compareResult.chunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          versionId: chunk.versionId,
          versionLabel: chunk.versionLabel,
          isCurrentVersion: chunk.isCurrentVersion,
          pageNumber: chunk.pageNumber,
          textPreview: previewText(chunk.text),
        })),
      ],
      versionComparison,
      whatChangedSummary: versionComparison?.mainChanges,
    };
  }

  const result = await queryDocumentChunksForRag({
    ctx: input.ctx,
    documentId: input.documentId,
    versionId: input.versionId,
    versionLabel: input.versionLabel,
    currentOnly: mode === 'current',
  });

  let scoredChunks = result.chunks.map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    versionId: chunk.versionId,
    versionLabel: chunk.versionLabel,
    isCurrentVersion: chunk.isCurrentVersion,
    pageNumber: chunk.pageNumber,
    textPreview: previewText(chunk.text),
  }));

  if (input.selectedClass && result.chunks.length > 0) {
    const documentChunks = mongoChunksToDocumentChunks(result.chunks);
    const retrieved = selectChunksForExtraction({
      chunks: documentChunks,
      selectedClass: input.selectedClass,
      topK: input.topK,
    });

    const scoreById = new Map(retrieved.map((chunk) => [chunk.id, chunk.score]));
    scoredChunks = result.chunks
      .map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        versionId: chunk.versionId,
        versionLabel: chunk.versionLabel,
        isCurrentVersion: chunk.isCurrentVersion,
        pageNumber: chunk.pageNumber,
        textPreview: previewText(chunk.text),
        score: scoreById.get(chunk._id) ?? 0,
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, input.topK ?? result.chunks.length);
  }

  return {
    documentId: input.documentId,
    mode,
    versionId: result.chunks[0]?.versionId ?? input.versionId,
    versionLabel: result.chunks[0]?.versionLabel ?? input.versionLabel,
    chunkCount: scoredChunks.length,
    chunks: scoredChunks,
  };
}

export async function answerWhatChanged(input: {
  ctx: RagChunkQueryInput['ctx'];
  documentId: string;
  fromVersionLabel: string;
  toVersionLabel?: string;
}): Promise<{
  documentId: string;
  fromVersionLabel: string;
  toVersionLabel: string;
  comparison: VersionComparisonResult;
}> {
  const toLabel = input.toVersionLabel ?? 'current';
  const fromVersion = await loadVersionRecord({
    ctx: input.ctx,
    documentId: input.documentId,
    versionLabel: input.fromVersionLabel,
  });

  let toVersion: MongoDocumentVersion | null;
  if (toLabel === 'current') {
    const doc = await input.ctx.collections.documents.findOne({
      _id: input.documentId,
      ...tenantScopeFilterFromContext(input.ctx.storage),
    } as Record<string, unknown>);
    toVersion = doc
      ? await loadVersionRecord({
          ctx: input.ctx,
          documentId: input.documentId,
          versionId: (doc as { currentVersionId: string }).currentVersionId,
        })
      : null;
  } else {
    toVersion = await loadVersionRecord({
      ctx: input.ctx,
      documentId: input.documentId,
      versionLabel: toLabel,
    });
  }

  if (!fromVersion || !toVersion) {
    return {
      documentId: input.documentId,
      fromVersionLabel: input.fromVersionLabel,
      toVersionLabel: toLabel,
      comparison: {
        changedFields: [],
        addedFields: [],
        removedFields: [],
        riskWarnings: ['Versão não encontrada para comparação.'],
        sameDocumentConfidence: 0,
        mainChanges: [],
      },
    };
  }

  const comparison = compareDocumentVersions({
    oldMetadata: fromVersion.metadata ?? {},
    newMetadata: toVersion.metadata ?? {},
    oldCategory: fromVersion.classification?.className,
    newCategory: toVersion.classification?.className,
    oldSummary: buildMetadataSummary(fromVersion.metadata ?? {}, fromVersion.classification?.className),
    newSummary: buildMetadataSummary(toVersion.metadata ?? {}, toVersion.classification?.className),
  });

  return {
    documentId: input.documentId,
    fromVersionLabel: input.fromVersionLabel,
    toVersionLabel: toVersion.versionLabel,
    comparison,
  };
}
