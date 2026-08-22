import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parseUploadAnalysisConcurrency } from '../src/features/upload/config/uploadConcurrency';
import { findNextQueuedItemExcluding } from '../src/features/upload/queue/uploadQueueCore';
import type { UploadQueueItem } from '../src/features/upload/types';

function makeItem(id: string, status: UploadQueueItem['status']): UploadQueueItem {
  return { id, fileName: `${id}.pdf`, fileSize: 100, status };
}

function readSrc(relativePath: string): string {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('concorrência do envio no navegador', () => {
  it('vale o padrão quando a configuração não diz nada de útil', () => {
    assert.equal(parseUploadAnalysisConcurrency(undefined), 3);
    assert.equal(parseUploadAnalysisConcurrency(''), 3);
    assert.equal(parseUploadAnalysisConcurrency('abc'), 3);
    assert.equal(parseUploadAnalysisConcurrency('0'), 3);
    assert.equal(parseUploadAnalysisConcurrency('-2'), 3);
  });

  it('respeita o valor configurado e o teto', () => {
    assert.equal(parseUploadAnalysisConcurrency('2'), 2);
    assert.equal(parseUploadAnalysisConcurrency('2.7'), 2);
    // Quem limita a vazão de verdade é o limitador da conta Groq no servidor.
    assert.equal(parseUploadAnalysisConcurrency('50'), 5);
  });

  it('1 restaura o comportamento antigo, um arquivo por vez', () => {
    assert.equal(parseUploadAnalysisConcurrency('1'), 1);
  });
});

describe('despacho de vários arquivos na mesma rodada', () => {
  it('não reenvia o item já despachado, que ainda consta como queued', () => {
    const items = [
      makeItem('a', 'queued'),
      makeItem('b', 'queued'),
      makeItem('c', 'queued'),
    ];

    const first = findNextQueuedItemExcluding(items, new Set());
    assert.equal(first?.id, 'a');

    // O React só repinta depois: sem a exclusão, 'a' sairia duas vezes na mesma rodada.
    const second = findNextQueuedItemExcluding(items, new Set(['a']));
    assert.equal(second?.id, 'b');

    const third = findNextQueuedItemExcluding(items, new Set(['a', 'b']));
    assert.equal(third?.id, 'c');

    assert.equal(findNextQueuedItemExcluding(items, new Set(['a', 'b', 'c'])), null);
  });

  it('ignora quem não está enfileirado', () => {
    const items = [
      makeItem('a', 'analyzing'),
      makeItem('b', 'review'),
      makeItem('c', 'queued'),
    ];

    assert.equal(findNextQueuedItemExcluding(items, new Set())?.id, 'c');
  });
});

describe('contrato do adiantamento no envio em lote', () => {
  it('o arquivo adiantado herda a requisição em voo, não abre outra', () => {
    const hook = readSrc('features/document-send/hooks/useBulkUploadQueue.ts');

    // A validação de posse compara o requestId que o servidor recebeu; criar outro na hora de
    // consumir faria a resposta adiantada ser recusada como se fosse de outro item.
    assert.ok(hook.includes('const prefetched = takeAnalysisPrefetch(next.id)'));
    assert.ok(hook.includes("const requestId = prefetched?.requestId ?? createRequestId()"));
    assert.ok(hook.includes('prefetched?.controller ?? new AbortController()'));
    assert.ok(hook.includes('prefetched?.promise ??'));
  });

  it('pausar, cancelar e resetar o lote derrubam as análises adiantadas', () => {
    const hook = readSrc('features/document-send/hooks/useBulkUploadQueue.ts');

    assert.ok(hook.includes("cancelAnalysisPrefetches('pausar lote')"));
    assert.ok(hook.includes("cancelAnalysisPrefetches('cancelar lote')"));
    assert.ok(hook.includes("cancelAnalysisPrefetches('resetar lote')"));
  });
});

describe('contrato do provider da fila da Biblioteca', () => {
  it('a vaga da análise é devolvida antes da contagem e da gravação', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');

    // Auto-confirmar não pode segurar a esteira: o arquivo seguinte sai enquanto este espera a
    // contagem regressiva e o confirmAnalysis.
    const inicioAuto = provider.indexOf("action === 'auto_confirm'");
    const trechoAuto = provider.slice(inicioAuto, inicioAuto + 400);
    assert.ok(trechoAuto.includes('tryPumpQueue();'), 'auto_confirm precisa liberar a fila');

    // Uma contagem por vez na tela, com fila de espera por ordem de chegada.
    assert.ok(provider.includes('pendingAutoConfirmRef'));
    assert.ok(provider.includes('startNextPendingAutoConfirm'));

    // O teto de análises em voo vem da configuração, não de um id único.
    assert.ok(provider.includes('getUploadAnalysisConcurrency'));
    assert.equal(provider.includes('processingItemIdRef'), false);
  });
});
