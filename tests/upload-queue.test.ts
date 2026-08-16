import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  countAwaitingReview,
  countPendingItems,
  countSavedDocuments,
  hasActiveItem,
  isItemSavedInLibrary,
  nextQueuedItem,
  uploadQueueReducer,
} from '../src/features/upload/queue/uploadQueueState.ts';
import {
  parseUploadAutoConfirmEnabled,
  resolvePostAnalysisAction,
} from '../src/features/upload/config/uploadAutoConfirm.ts';
import { prepareUploadItems } from '../src/features/upload/services/startUploadFromFiles.ts';
import {
  analysisFailureMessage,
  needsManualReviewConfirmation,
  UPLOAD_ANALYZE_TIMEOUT_MS,
  parseUploadAnalyzeTimeoutMs,
  uploadAnalyzeTimeoutMessage,
} from '../src/features/upload/queue/uploadQueueAnalysis.ts';
import type { UploadQueueItem } from '../src/features/upload/types.ts';
import type { AnalyzePdfResponse } from '../src/features/document-send/services/analyzePdf.ts';
import type { ExtractedMetadata } from '../src/features/document-send/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

function makeItem(overrides: Partial<UploadQueueItem> = {}): UploadQueueItem {
  return {
    id: 'item-1',
    fileName: 'contrato.pdf',
    fileSize: 1024,
    status: 'queued',
    ...overrides,
  };
}

describe('fila de upload — transições de estado', () => {
  it('enqueue adiciona itens preservando os existentes', () => {
    const state = uploadQueueReducer([makeItem()], {
      type: 'enqueue',
      items: [makeItem({ id: 'item-2' })],
    });
    assert.equal(state.length, 2);
  });

  it('done marca item com documentId e limpa erro', () => {
    const state = uploadQueueReducer(
      [makeItem({ status: 'confirming', errorMessage: 'x' })],
      { type: 'done', id: 'item-1', documentId: 'doc-9' },
    );
    assert.equal(state[0].status, 'done');
    assert.equal(state[0].documentId, 'doc-9');
    assert.equal(state[0].errorMessage, undefined);
  });

  it('error registra mensagem; retry reencaminha para a fila', () => {
    let state = uploadQueueReducer([makeItem({ status: 'analyzing' })], {
      type: 'error',
      id: 'item-1',
      message: 'falhou',
    });
    assert.equal(state[0].status, 'error');
    assert.equal(state[0].errorMessage, 'falhou');

    state = uploadQueueReducer(state, { type: 'retry', id: 'item-1' });
    assert.equal(state[0].status, 'queued');
    assert.equal(state[0].errorMessage, undefined);
  });

  it('retry não afeta itens que não estão em erro', () => {
    const state = uploadQueueReducer([makeItem({ status: 'done' })], {
      type: 'retry',
      id: 'item-1',
    });
    assert.equal(state[0].status, 'done');
  });

  it('clear-finished remove apenas concluídos', () => {
    const state = uploadQueueReducer(
      [makeItem({ status: 'done' }), makeItem({ id: 'item-2', status: 'error' })],
      { type: 'clear-finished' },
    );
    assert.equal(state.length, 1);
    assert.equal(state[0].id, 'item-2');
  });

  it('fila processa um por vez, mas revisão pendente não trava o lote', () => {
    const analyzing = [
      makeItem({ id: 'a', status: 'analyzing' }),
      makeItem({ id: 'b', status: 'queued' }),
    ];
    assert.equal(hasActiveItem(analyzing), true);
    assert.equal(nextQueuedItem(analyzing)?.id, 'b');

    // Um arquivo mandado para revisão espera uma pessoa, não o servidor: os limpos seguem.
    const awaitingReview = [
      makeItem({ id: 'a', status: 'review' }),
      makeItem({ id: 'b', status: 'queued' }),
    ];
    assert.equal(hasActiveItem(awaitingReview), false);
    assert.equal(nextQueuedItem(awaitingReview)?.id, 'b');

    const awaitingApproval = [
      makeItem({ id: 'a', status: 'awaiting_approval', approvalId: 'ap-1' }),
      makeItem({ id: 'b', status: 'queued' }),
    ];
    assert.equal(hasActiveItem(awaitingApproval), false);
    assert.equal(nextQueuedItem(awaitingApproval)?.id, 'b');

    assert.equal(countPendingItems([makeItem({ status: 'done' })]), 0);
  });

  it('review conta como pendente; done só com documentId é salvo na Biblioteca', () => {
    const reviewItem = makeItem({ status: 'review' });
    const savedItem = makeItem({ status: 'done', documentId: 'doc-1' });
    const doneWithoutDoc = makeItem({ status: 'done' });

    assert.equal(countPendingItems([reviewItem]), 1);
    assert.equal(countAwaitingReview([reviewItem]), 1);
    assert.equal(countSavedDocuments([savedItem]), 1);
    assert.equal(countSavedDocuments([doneWithoutDoc]), 0);
    assert.equal(isItemSavedInLibrary(savedItem), true);
    assert.equal(isItemSavedInLibrary(doneWithoutDoc), false);
  });
});

describe('preparação de upload — mesmas regras do fluxo legado', () => {
  it('aceita PDFs válidos e gera itens de fila com contexto', () => {
    const file = new File([new Blob(['%PDF'])], 'contrato.pdf', { type: 'application/pdf' });
    const result = prepareUploadItems([file], { categoryId: 'cat-1', categoryName: 'Jurídico' });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.items[0].fileName, 'contrato.pdf');
      assert.equal(result.items[0].status, 'queued');
      assert.equal(result.items[0].context?.categoryId, 'cat-1');
    }
  });

  it('aceita imagens JPG/PNG/WebP e rejeita formatos não suportados', () => {
    const png = new File([new Blob(['x'])], 'foto.png', { type: 'image/png' });
    const pngResult = prepareUploadItems([png]);
    assert.equal(pngResult.ok, true);

    const docx = new File([new Blob(['x'])], 'relatorio.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const docxResult = prepareUploadItems([docx]);
    assert.equal(docxResult.ok, false);
  });

  it('respeita o limite de lote considerando itens pendentes', () => {
    const file = new File([new Blob(['%PDF'])], 'a.pdf', { type: 'application/pdf' });
    const result = prepareUploadItems([file], undefined, 20);
    assert.equal(result.ok, false);
  });
});

describe('auto-confirm da fila da Biblioteca', () => {
  it('default é desativado (governança: revisar antes de salvar)', () => {
    assert.equal(parseUploadAutoConfirmEnabled(undefined), false);
    assert.equal(parseUploadAutoConfirmEnabled(null), false);
    assert.equal(parseUploadAutoConfirmEnabled(''), false);
    assert.equal(parseUploadAutoConfirmEnabled('false'), false);
    assert.equal(parseUploadAutoConfirmEnabled('TRUE'), true);
  });

  it('completed com auto-confirm desativado abre ReviewDrawer, não confirma direto', () => {
    assert.equal(resolvePostAnalysisAction('completed', false), 'open_review');
  });

  it('completed com auto-confirm ativado confirma automaticamente', () => {
    assert.equal(resolvePostAnalysisAction('completed', true), 'auto_confirm');
  });

  it('requires_review sempre abre ReviewDrawer, independente do flag', () => {
    assert.equal(resolvePostAnalysisAction('requires_review', false), 'open_review');
    assert.equal(resolvePostAnalysisAction('requires_review', true), 'open_review');
  });

  it('status inválido falha sem confirmar', () => {
    assert.equal(resolvePostAnalysisAction('failed', false), 'fail');
    assert.equal(resolvePostAnalysisAction('ai_unavailable', true), 'fail');
  });
});

describe('provider da fila — integração com contratos existentes', () => {
  it('usa analyzePdf e confirmAnalysis reais (sem mock, sem novo endpoint)', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes("from './services/analyzePdf'"));
    assert.ok(provider.includes("from './services/confirmAnalysis'"));
    const analyzeAdapter = readSrc('features/upload/services/analyzePdf.ts');
    const confirmAdapter = readSrc('features/upload/services/confirmAnalysis.ts');
    assert.ok(analyzeAdapter.includes('document-send/services/analyzePdf'));
    assert.ok(confirmAdapter.includes('document-send/services/confirmAnalysis'));
  });

  it('provider usa resolveQueueAnalysisAction e preferências do usuário', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes('resolveQueueAnalysisAction'));
    assert.ok(provider.includes('useReviewWorkflowSettingsState'));
    assert.ok(provider.includes('isUploadAutoConfirmEnabled'));
    assert.ok(provider.includes("action === 'auto_confirm'"));
    assert.ok(provider.includes("action === 'open_review'"));
  });

  it('requires_review abre revisão; invalida queries reais da Biblioteca após salvar', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes('resolveFinalFileNameForConfirm'));
    assert.ok(provider.includes('manualReviewConfirmed'));
    assert.ok(provider.includes('invalidateLibraryQueries'));
    assert.equal(provider.includes("queryKey: ['library-documents']"), false);
    assert.ok(provider.includes("status: 'review'"));
  });

  it('open_review estaciona o arquivo e segue com o lote', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes("toast.info('Análise concluída"));

    // O que segue o lote: os dois desvios que estacionam o arquivo chamam tryPumpQueue antes de
    // sair. Sem isso, um documento em revisão trava todos os outros até alguém abrir a tela.
    const trechoRevisao = provider.slice(
      provider.indexOf("action === 'open_review'"),
      provider.indexOf("action === 'ai_pause'"),
    );
    assert.ok(trechoRevisao.includes('tryPumpQueue();'), 'open_review precisa liberar a fila');

    const inicioPausa = provider.indexOf("action === 'ai_pause'");
    const trechoPausa = provider.slice(inicioPausa, inicioPausa + 400);
    assert.ok(trechoPausa.includes('tryPumpQueue();'), 'ai_pause precisa liberar a fila');

    assert.ok(readSrc('features/upload/queue/uploadQueueCore.ts').includes('UPLOAD_PARKED_STATUSES'));
  });

  it('provider não cancela analyze in-flight ao mudar status para analyzing', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    // Uma entrada por arquivo em voo: o id único de antes era o que serializava o lote, e um
    // `abort` global cancelaria o vizinho a cada novo despacho.
    assert.ok(provider.includes('inFlightAnalysesRef'));
    assert.ok(provider.includes('UPLOAD_ANALYZE_TIMEOUT_MS'));
    assert.ok(provider.includes('uploadAnalyzeTimeoutMessage'));
    assert.equal(provider.includes('let cancelled = false'), false);
    assert.equal(provider.includes('cancelled = true'), false);
  });

  it('confirmReview não força manualReviewConfirmed com requiresReview || true', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.equal(provider.includes('requiresReview || true'), false);
    assert.ok(provider.includes('needsManualReviewConfirmation'));
  });

  it('uploadQueueAnalysis — mensagens e timeout', () => {
    // Com fila, o tempo de espera inclui os documentos na frente. Um teto curto marcava erro na
    // tela para um documento que o servidor terminou de analisar depois.
    assert.equal(UPLOAD_ANALYZE_TIMEOUT_MS, 300_000);
    assert.equal(parseUploadAnalyzeTimeoutMs('45000'), 45_000);
    assert.equal(parseUploadAnalyzeTimeoutMs('9999999'), 600_000);
    assert.equal(parseUploadAnalyzeTimeoutMs('1000'), 30_000);
    assert.match(uploadAnalyzeTimeoutMessage(), /confira na Biblioteca/);
    assert.match(analysisFailureMessage('ai_unavailable'), /Groq|limite/i);
    assert.match(analysisFailureMessage('ai_unavailable', 'GROQ_REQUEST_TIMEOUT'), /interrompida/i);
    assert.match(analysisFailureMessage('failed'), /falhou/i);

    const metadata = {
      analysisStatus: 'requires_review',
    } as ExtractedMetadata;
    const raw = {
      status: 'requires_review',
      classification: { requiresReview: true },
      extraction: null,
    } as AnalyzePdfResponse;
    assert.equal(needsManualReviewConfirmation(metadata, raw), true);
  });

  it('ReviewDrawer exige checkbox e suporta nomeação por arquivo', () => {
    const drawer = readSrc('features/upload/review/ReviewDrawer.tsx');
    assert.ok(drawer.includes('confirmReview'));
    assert.ok(drawer.includes('reviewChecked'));
    assert.ok(drawer.includes('DocumentNamingSection'));
    assert.ok(drawer.includes('Confirmar e salvar'));
  });

  it('UploadQueueDrawer não usa headline enganosa "Uploads concluídos"', () => {
    const drawer = readSrc('features/upload/UploadQueueDrawer.tsx');
    assert.equal(drawer.includes('Uploads concluídos'), false);
    assert.ok(drawer.includes('countSubmittedItems'));
    assert.ok(drawer.includes('Aguardando revisão'));
    assert.ok(drawer.includes('Salvo na Biblioteca'));
    assert.ok(drawer.includes('uploadStatusProgress'));
    assert.ok(drawer.includes('role="progressbar"'));
  });

  it('DocumentSendPage legado invalida queries da Biblioteca após salvar', () => {
    const sendPage = readSrc('features/document-send/DocumentSendPage.tsx');
    assert.ok(sendPage.includes('invalidateDocumentQueries'));
    assert.ok(sendPage.includes('invalidateLibraryQueries'));
  });

  it('DocumentSendPage legado mantém auto-confirm próprio, independente da fila da Biblioteca', () => {
    const sendPage = readSrc('features/document-send/DocumentSendPage.tsx');
    assert.ok(sendPage.includes('autoConfirmTriggeredRef'));
    assert.ok(sendPage.includes('ReviewWorkflowSettingsPanel'));
    assert.ok(sendPage.includes('canAutoAcceptWithSettings'));
    assert.equal(sendPage.includes('VITE_UPLOAD_AUTO_CONFIRM_ENABLED'), false);
    assert.equal(sendPage.includes('resolvePostAnalysisAction'), false);
  });
});
