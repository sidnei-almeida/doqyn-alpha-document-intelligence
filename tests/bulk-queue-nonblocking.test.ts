import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function readSrc(relativePath: string): string {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('lote do envio não trava esperando pessoa', () => {
  it('revisão manual estaciona o documento e a esteira segue', () => {
    const hook = readSrc('features/document-send/hooks/useBulkUploadQueue.ts');

    // Sobra um único `return 'manual'`: o caso de IA indisponível, que pausa o lote inteiro de
    // propósito — insistir contra um provedor limitado só produz mais falha.
    const manualReturns = hook.match(/return 'manual';/g) ?? [];
    assert.equal(manualReturns.length, 1);

    const aiPausedBlock = hook.slice(
      hook.indexOf('IA temporariamente indisponível'),
      hook.indexOf('IA temporariamente indisponível') + 300,
    );
    assert.match(aiPausedBlock, /return 'manual';/);
  });

  it('as ações de revisão recebem o item, não o "item da vez"', () => {
    const hook = readSrc('features/document-send/hooks/useBulkUploadQueue.ts');

    assert.match(hook, /confirmItemAndContinue = useCallback\(async \(targetItemId\?: string\)/);
    assert.match(hook, /skipItem = useCallback\(\(targetItemId\?: string\)/);
    assert.match(hook, /reprocessItem = useCallback\(\(targetItemId\?: string\)/);
    assert.match(hook, /updateItemNaming = useCallback\(/);

    // Nomes antigos não podem sobreviver: eram eles que amarravam a revisão ao item corrente.
    assert.equal(hook.includes('confirmCurrentAndContinue'), false);
    assert.equal(hook.includes('skipCurrent'), false);
  });

  it('cancelar o automático não para o lote', () => {
    const hook = readSrc('features/document-send/hooks/useBulkUploadQueue.ts');
    const start = hook.indexOf('const cancelAutoCountdown');
    const block = hook.slice(start, start + 700);

    assert.match(block, /scheduleQueueWorker\(\)/);
    assert.equal(block.includes('manualGateRef.current = true'), false);
  });

  it('o painel revisa o documento selecionado na lista', () => {
    const panel = readSrc('features/document-send/components/BulkBatchPanel.tsx');

    assert.match(panel, /const reviewTarget =/);
    assert.match(panel, /onConfirmContinue\(reviewTarget\.id\)/);
    // Os botões deixam de depender da esteira estar travada.
    assert.equal(panel.includes('manualGate &&'), false);
  });

  it('reprocessar um documento parado não derruba a análise em curso', () => {
    const hook = readSrc('features/document-send/hooks/useBulkUploadQueue.ts');
    const start = hook.indexOf('const reprocessItem');
    const block = hook.slice(start, start + 900);

    assert.match(block, /if \(itemId === currentItemIdRef\.current\) \{\s*\n\s*resetCurrentProcessingState/);
  });
});
