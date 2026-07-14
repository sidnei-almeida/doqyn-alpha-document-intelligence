import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnalyzePdfResponse } from '../src/features/document-send/services/analyzePdf';
import type { ExtractedMetadata } from '../src/features/document-send/types';
import {
  findNextQueuedItem,
  getAutoSaveBlockers,
  hasInFlightUploadItem,
  resolveAnalysisOutcome,
  resolveQueueAnalysisAction,
  startCountdownSeconds,
} from '../src/features/upload/queue/uploadQueueCore';
import { clampAutoDelaySeconds } from '../src/features/document-send/uploadConstants';
import { DEFAULT_WORKFLOW_REVIEW_SETTINGS } from '../src/features/document-send/utils/reviewWorkflowSettings';
import type { UploadQueueItem } from '../src/features/upload/types';

function makeUploadItem(status: UploadQueueItem['status']): UploadQueueItem {
  return {
    id: 'item-1',
    fileName: 'doc.pdf',
    fileSize: 100,
    status,
  };
}

function makeAnalysis(overrides: Partial<AnalyzePdfResponse> = {}): AnalyzePdfResponse {
  return {
    jobId: 'job-1',
    status: 'completed',
    originalFileName: 'doc.pdf',
    fileHash: 'hash',
    fileSizeBytes: 100,
    recommendedFileName: '2024-doc.pdf',
    textExtraction: { status: 'completed', charCount: 500, truncated: false },
    classification: {
      classId: 'class-1',
      className: 'Contrato',
      confidence: 0.95,
      requiresReview: false,
      reason: 'ok',
      evidence: [],
    },
    extraction: {
      documentType: 'Contrato',
      version: 'v1.0',
      metadata: {},
      missingFields: [],
      requiresReview: false,
      reviewReasons: [],
    },
    logs: [],
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<ExtractedMetadata> = {}): ExtractedMetadata {
  return {
    jobId: 'job-1',
    originalFileName: 'doc.pdf',
    suggestedName: '2024-doc.pdf',
    documentType: 'Contrato',
    suggestedVersion: 'v1.0',
    confidenceScore: 0.95,
    analysisStatus: 'completed',
    missingFields: [],
    reviewReasons: [],
    extractedFields: [],
    textExtraction: { status: 'completed', charCount: 500, truncated: false },
    ...overrides,
  };
}

describe('uploadQueueCore', () => {
  it('findNextQueuedItem retorna o primeiro item enfileirado', () => {
    const items: UploadQueueItem[] = [
      { ...makeUploadItem('done'), id: 'done-1' },
      { ...makeUploadItem('queued'), id: 'queued-1' },
      { ...makeUploadItem('queued'), id: 'queued-2' },
    ];
    assert.equal(findNextQueuedItem(items)?.id, 'queued-1');
  });

  it('hasInFlightUploadItem detecta analyzing/review/confirming', () => {
    assert.equal(hasInFlightUploadItem([makeUploadItem('queued')]), false);
    assert.equal(hasInFlightUploadItem([makeUploadItem('analyzing')]), true);
    assert.equal(hasInFlightUploadItem([makeUploadItem('review')]), true);
  });

  it('resolveAnalysisOutcome mapeia requires_review e ai_paused', () => {
    const metadata = makeMetadata({ analysisStatus: 'requires_review' });
    const raw = makeAnalysis({ status: 'requires_review' });
    assert.equal(resolveAnalysisOutcome(metadata, raw).status, 'requires_review');

    const paused = resolveAnalysisOutcome(makeMetadata(), makeAnalysis({ status: 'ai_unavailable' }));
    assert.equal(paused.status, 'ai_paused');
  });

  it('resolveQueueAnalysisAction respeita auto-confirm do deploy', () => {
    const metadata = makeMetadata();
    const raw = makeAnalysis();
    const action = resolveQueueAnalysisAction(DEFAULT_WORKFLOW_REVIEW_SETTINGS, metadata, raw, {
      deployAutoConfirm: true,
      isAuthenticated: true,
    });
    assert.equal(action, 'auto_confirm');
  });

  it('resolveQueueAnalysisAction pausa fila em ai_unavailable', () => {
    const metadata = makeMetadata({ analysisStatus: 'ai_unavailable' });
    const raw = makeAnalysis({ status: 'ai_unavailable', errorCode: 'GROQ_RATE_LIMIT' });
    const action = resolveQueueAnalysisAction(DEFAULT_WORKFLOW_REVIEW_SETTINGS, metadata, raw, {
      deployAutoConfirm: true,
      isAuthenticated: true,
    });
    assert.equal(action, 'ai_pause');
  });

  it('hasInFlightUploadItem detecta ai_paused', () => {
    assert.equal(hasInFlightUploadItem([makeUploadItem('ai_paused')]), true);
  });

  it('getAutoSaveBlockers exige autenticação', () => {
    const blockers = getAutoSaveBlockers({
      isAuthenticated: false,
      metadata: makeMetadata(),
      rawAnalysis: makeAnalysis(),
    });
    assert.ok(blockers.some((entry) => entry.includes('autenticado')));
  });

  it('clampAutoDelaySeconds permite 0', () => {
    assert.equal(clampAutoDelaySeconds(0), 0);
    assert.equal(clampAutoDelaySeconds(-2), 0);
    assert.equal(clampAutoDelaySeconds(3), 3);
  });

  it('startCountdownSeconds com 0s completa imediatamente', async () => {
    const ticks: number[] = [];
    const handle = startCountdownSeconds(0, (remaining) => ticks.push(remaining), () => true);
    const finished = await handle.completed;
    assert.equal(finished, true);
    assert.deepEqual(ticks, [0]);
  });
});
