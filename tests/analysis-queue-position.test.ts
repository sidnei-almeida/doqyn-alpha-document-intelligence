import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatQueueWaitLabel,
  formatWaitSeconds,
} from '../src/features/upload/queue/queueWaitLabel';
import { analysisPollDelayMs } from '../src/features/document-send/services/analysisPollBackoff';
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

describe('índices de analysis_jobs', () => {
  it('cobre a contagem de posição e a janela de vazão', () => {
    const keys = ANALYSIS_JOB_INDEXES.map((index) => JSON.stringify(index.key));

    // Sem estes dois, a posição na fila vira varredura da coleção a cada consulta de status.
    assert.ok(keys.includes(JSON.stringify({ status: 1, createdAt: -1 })));
    assert.ok(keys.includes(JSON.stringify({ status: 1, completedAt: -1 })));
    assert.ok(keys.includes(JSON.stringify({ tenantId: 1, ownerUserId: 1, createdAt: -1 })));
  });
});
