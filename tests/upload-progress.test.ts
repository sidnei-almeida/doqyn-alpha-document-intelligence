import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  buildTrackingHref,
  deriveSingleFileUploadProgressState,
  getUploadProgressPercent,
} from '../src/features/document-send/utils/uploadProgress.ts';

const PROGRESS = join(process.cwd(), 'src/components/ui/Progress.tsx');

describe('uploadProgress helpers', () => {
  it('idle retorna 0%', () => {
    const state = deriveSingleFileUploadProgressState({ flowPhase: 'idle' });
    assert.equal(state.status, 'idle');
    assert.equal(state.percent, 0);
    assert.match(state.message, /Arraste um PDF/i);
  });

  it('analyzing tem progresso maior que uploading', () => {
    assert.ok(getUploadProgressPercent('analyzing') > getUploadProgressPercent('uploading'));
  });

  it('completed retorna 100%', () => {
    const state = deriveSingleFileUploadProgressState({ flowPhase: 'saved' });
    assert.equal(state.status, 'completed');
    assert.equal(state.percent, 100);
  });

  it('failed mostra mensagem de erro amigável', () => {
    const state = deriveSingleFileUploadProgressState({
      flowPhase: 'error',
      errorMessage: 'Não foi possível analisar o documento.',
    });
    assert.equal(state.status, 'failed');
    assert.match(state.message, /Não foi possível analisar/i);
  });

  it('buildTrackingHref prioriza documentId', () => {
    assert.equal(buildTrackingHref('doc_1', 'req_1'), '/tracking?documentId=doc_1');
    assert.equal(buildTrackingHref(undefined, 'req_1'), '/tracking?requestId=req_1');
    assert.equal(buildTrackingHref(), null);
  });
});

describe('UploadProgressSummary UI', () => {
  it('Progress usa role progressbar com aria', () => {
    const source = readFileSync(PROGRESS, 'utf8');
    assert.match(source, /role="progressbar"/);
    assert.match(source, /aria-valuemin=\{0\}/);
    assert.match(source, /aria-valuemax=\{100\}/);
    assert.match(source, /aria-valuenow=/);
    assert.match(source, /aria-label=/);
  });





});
