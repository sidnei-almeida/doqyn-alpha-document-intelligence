import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatQueueWaitLabel,
  formatWaitSeconds,
} from '../src/features/upload/queue/queueWaitLabel';
import { analysisPollDelayMs } from '../src/features/document-send/services/analysisPollBackoff';
import { uploadAnalyzeStillRunningMessage } from '../src/features/upload/queue/uploadQueueAnalysis';
import {
  hasActiveItem,
  uploadQueueReducer,
} from '../src/features/upload/queue/uploadQueueState';
import { countParkedUploadItems } from '../src/features/upload/queue/uploadQueueCore';
import type { UploadQueueItem } from '../src/features/upload/types';
import { ANALYSIS_JOB_INDEXES } from '../server/db/analysisJobIndexes.js';

describe('texto de espera na tela', () => {
  it('traduz segundos em algo que o usuário entende', () => {
    assert.equal(formatWaitSeconds(30), 'menos de 1 min');
    assert.equal(formatWaitSeconds(59), 'menos de 1 min');
    assert.equal(formatWaitSeconds(120), '~2 min');
    assert.equal(formatWaitSeconds(3_600), '~1 h');
    assert.equal(formatWaitSeconds(9_000), '~3 h');
  });

  it('mostra a posição quando há gente na frente', () => {
    assert.equal(
      formatQueueWaitLabel({ status: 'queued', queuePosition: 1, estimatedWaitSeconds: 120 }),
      '1 documento na frente · ~2 min',
    );
    assert.equal(
      formatQueueWaitLabel({ status: 'queued', queuePosition: 400, estimatedWaitSeconds: 7_200 }),
      '400 documentos na frente · ~2 h',
    );
  });

  it('sem vazão medida, mostra só a posição — número inventado é pior que nenhum', () => {
    assert.equal(
      formatQueueWaitLabel({ status: 'queued', queuePosition: 3, estimatedWaitSeconds: null }),
      '3 documentos na frente',
    );
  });

  it('posição zero é a vez dele, não "0 na frente"', () => {
    assert.equal(
      formatQueueWaitLabel({ status: 'processing', queuePosition: 0, estimatedWaitSeconds: 40 }),
      'Na vez · menos de 1 min',
    );
    assert.equal(
      formatQueueWaitLabel({ status: 'processing', queuePosition: 0, estimatedWaitSeconds: null }),
      null,
    );
  });

  it('cala a boca quando o documento já saiu da fila', () => {
    assert.equal(formatQueueWaitLabel(undefined), null);
    assert.equal(
      formatQueueWaitLabel({ status: 'completed', queuePosition: 2, estimatedWaitSeconds: 60 }),
      null,
    );
  });
});

describe('recuo progressivo na consulta de status', () => {
  it('começa rápido e cresce até o teto', () => {
    assert.equal(analysisPollDelayMs(1, () => 0), 2_000);
    assert.equal(analysisPollDelayMs(2, () => 0), 3_000);
    assert.equal(analysisPollDelayMs(3, () => 0), 4_500);
    // Teto: consultar de 10 em 10 segundos numa espera longa já é bastante.
    assert.equal(analysisPollDelayMs(20, () => 0), 10_000);
  });

  it('dispersa para os arquivos em voo não perguntarem em uníssono', () => {
    assert.equal(analysisPollDelayMs(1, () => 0.5), 2_250);
  });
});

describe('espera longa não é erro', () => {
  it('o item vai para `still_running`, não para `error`, e guarda o aviso', () => {
    const items: UploadQueueItem[] = [
      { id: 'a', fileName: 'contrato.pdf', fileSize: 10, status: 'analyzing' },
    ];

    const state = uploadQueueReducer(items, {
      type: 'still_running',
      id: 'a',
      message: uploadAnalyzeStillRunningMessage(),
    });

    assert.equal(state[0].status, 'still_running');
    assert.match(state[0].errorMessage ?? '', /continua no servidor/);
  });

  it('`still_running` sai da esteira sem sair da fila', () => {
    const items: UploadQueueItem[] = [
      { id: 'a', fileName: 'contrato.pdf', fileSize: 10, status: 'still_running' },
      { id: 'b', fileName: 'outro.pdf', fileSize: 10, status: 'queued' },
    ];

    // Não ocupa vaga de análise: o próximo arquivo segue.
    assert.equal(hasActiveItem(items), false);
    assert.equal(countParkedUploadItems(items), 1);
  });

  it('reenviar é decisão de quem está na tela, e continua disponível', () => {
    const items: UploadQueueItem[] = [
      { id: 'a', fileName: 'contrato.pdf', fileSize: 10, status: 'still_running' },
    ];

    const state = uploadQueueReducer(items, { type: 'retry', id: 'a' });
    assert.equal(state[0].status, 'queued');
    assert.equal(state[0].errorMessage, undefined);
  });
});

describe('índices de analysis_jobs', () => {
  it('cobre a contagem de posição e a janela de vazão', () => {
    const keys = ANALYSIS_JOB_INDEXES.map((index) => JSON.stringify(index.key));

    // Sem estes dois, a posição na fila vira varredura da coleção a cada consulta de status.
    assert.ok(keys.includes(JSON.stringify({ status: 1, createdAt: -1 })));
    assert.ok(keys.includes(JSON.stringify({ status: 1, completedAt: -1 })));
    assert.ok(keys.includes(JSON.stringify({ tenantId: 1, ownerUserId: 1, createdAt: -1 })));
  });
});
