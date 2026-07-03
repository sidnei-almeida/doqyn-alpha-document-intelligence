import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  buildTrackingHref,
  deriveSingleFileUploadProgressState,
  getUploadProgressPercent,
} from '../src/features/document-send/utils/uploadProgress.ts';

const SEND_PAGE = join(
  process.cwd(),
  'src/features/document-send/DocumentSendPage.tsx',
);
const SUMMARY = join(
  process.cwd(),
  'src/features/document-send/components/UploadProgressSummary.tsx',
);
const PROGRESS = join(process.cwd(), 'src/components/ui/Progress.tsx');

describe('uploadProgress helpers', () => {
  it('idle retorna 0%', () => {
    const state = deriveSingleFileUploadProgressState({ flowPhase: 'idle' });
    assert.equal(state.status, 'idle');
    assert.equal(state.percent, 0);
    assert.match(state.message, /Selecione um documento/i);
  });

  it('analyzing tem progresso maior que uploading', () => {
    assert.ok(
      getUploadProgressPercent('analyzing') > getUploadProgressPercent('uploading'),
    );
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
    assert.equal(
      buildTrackingHref('doc_1', 'req_1'),
      '/tracking?documentId=doc_1',
    );
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

  it('não renderiza filtros antigos na página de envio', () => {
    const source = readFileSync(SEND_PAGE, 'utf8');
    assert.equal(source.includes('WorkflowSessionPanel'), false);
    assert.equal(source.includes('logFilter'), false);
    assert.equal(source.includes('showDebugLogs'), false);
    for (const label of ['Todos', 'Arquivo atual', 'Logs do lote']) {
      assert.equal(source.includes(label), false, `não deve conter "${label}"`);
    }
  });

  it('Debug só via canShowTechnicalDetails no resumo', () => {
    const summary = readFileSync(SUMMARY, 'utf8');
    assert.match(summary, /canShowTechnicalDetails/);
    assert.equal(summary.includes('type="checkbox"'), false);
    assert.match(summary, /Ver detalhes técnicos/);
  });

  it('link de tracking só quando canViewTracking e href existem', () => {
    const summary = readFileSync(SUMMARY, 'utf8');
    assert.match(summary, /canViewTracking && trackingHref/);
    assert.match(summary, /Ver tracking completo/);
  });

  it('sanitiza chaves sensíveis nos detalhes técnicos', () => {
    const summary = readFileSync(SUMMARY, 'utf8');
    assert.match(summary, /objectKey|token|secret|password|payload/i);
  });

  it('página de envio usa UploadProgressSummary', () => {
    const source = readFileSync(SEND_PAGE, 'utf8');
    assert.match(source, /UploadProgressSummary/);
    assert.match(source, /canViewTracking=\{canShowWorkflowDebug\}/);
  });
});
