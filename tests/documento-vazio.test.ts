import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { emptyDocumentReason } from '../src/features/document-send/services/emptyDocument.js';
import { mergeNativeAndOcrPages } from '../server/ai/services/documentTextExtractor.js';
import { resolveQueueAnalysisAction } from '../src/features/upload/queue/uploadQueueCore.js';
import { analysisHasResolvableCategory } from '../src/features/document-send/services/normalizeConfirmPayload.js';
import {
  DEFAULT_TENANT_UPLOAD_POLICY,
  isEmptyDocumentMode,
  normalizeTenantUploadPolicy,
} from '../shared/uploadPolicy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

type AnalyzeResponse = Parameters<typeof emptyDocumentReason>[0];

function analysis(overrides: Record<string, unknown> = {}): AnalyzeResponse {
  return {
    jobId: 'job_1',
    status: 'requires_review',
    originalFileName: 'folha.pdf',
    fileHash: 'h',
    fileSizeBytes: 1024,
    recommendedFileName: null,
    textExtraction: { status: 'failed', pageCount: 1, charCount: 0, truncated: false },
    classification: {
      classId: null,
      className: null,
      confidence: 0,
      requiresReview: true,
      reason: 'Sem texto.',
      evidence: [],
    },
    extraction: null,
    logs: [],
    ...overrides,
  } as unknown as AnalyzeResponse;
}

describe('documento sem texto', () => {
  it('reconhece os dois códigos com que o servidor encerra por falta de texto', () => {
    assert.equal(
      emptyDocumentReason(analysis({ errorCode: 'INSUFFICIENT_TEXT' })),
      'INSUFFICIENT_TEXT',
    );
    assert.equal(
      emptyDocumentReason(analysis({ errorCode: 'VISION_OCR_FAILED' })),
      'VISION_OCR_FAILED',
    );
  });

  it('não adivinha por contagem de caracteres', () => {
    /**
     * `charCount: 0` sem código é resposta parcial, não folha em branco — a análise pode ter
     * parado antes de extrair. Adivinhar aqui fazia qualquer payload incompleto virar documento
     * vazio, e foi o que quebrou a guarda de categoria do `auto_create`.
     */
    assert.equal(emptyDocumentReason(analysis()), null);
  });

  it('a política do tenant decide o que acontece com a folha em branco', () => {
    const vazio = analysis({ errorCode: 'INSUFFICIENT_TEXT' });
    const options = { deployAutoConfirm: false, isAuthenticated: true };
    const metadata = { analysisStatus: 'requires_review' } as never;

    const action = (mode: 'review' | 'auto_save' | 'auto_reject') =>
      resolveQueueAnalysisAction(
        normalizeTenantUploadPolicy({ ...DEFAULT_TENANT_UPLOAD_POLICY, emptyDocumentMode: mode }),
        metadata,
        vazio,
        options,
      );

    assert.equal(action('review'), 'open_review');
    assert.equal(action('auto_save'), 'auto_confirm');
    assert.equal(action('auto_reject'), 'reject');
  });

  it('perguntar é o padrão — salvar sem avisar era o defeito', () => {
    assert.equal(DEFAULT_TENANT_UPLOAD_POLICY.emptyDocumentMode, 'review');
    assert.equal(normalizeTenantUploadPolicy({}).emptyDocumentMode, 'review');
    // Valor desconhecido (política antiga, body forjado) não liga salvamento automático.
    assert.equal(
      normalizeTenantUploadPolicy({ emptyDocumentMode: 'sempre' as never }).emptyDocumentMode,
      'review',
    );
    assert.ok(isEmptyDocumentMode('auto_reject'));
    assert.ok(!isEmptyDocumentMode('auto_delete'));
  });

  it('documento vazio não fica preso atrás da escolha de categoria', () => {
    // Sem texto a IA não classifica e não há proposta a criar: exigir pasta aqui era pedir uma
    // decisão que ninguém consegue tomar com informação. O servidor arquiva em "Sem categoria".
    assert.ok(analysisHasResolvableCategory(analysis({ errorCode: 'INSUFFICIENT_TEXT' })));
    assert.ok(!analysisHasResolvableCategory(analysis()));
  });
});

describe('a recusa por política não vive só no navegador', () => {
  it('a confirmação relê a política do tenant antes de gravar', () => {
    const confirm = read('server/services/confirmAnalysisService.ts');
    // A fila barra antes, mas quem barra é o navegador com a política que tinha em mãos: aba
    // velha aberta desde antes da troca passaria direto.
    assert.ok(confirm.includes('MIN_TEXT_CHARS'));
    assert.ok(confirm.includes("emptyDocumentMode === 'auto_reject'"));
    assert.ok(confirm.includes('EMPTY_DOCUMENT_REJECTED'));
  });
});

describe('o modo salvar-sozinho não atropela a nomeação', () => {
  it('política que exige nome humano manda para a revisão mesmo em auto_save', () => {
    const vazio = analysis({ errorCode: 'INSUFFICIENT_TEXT' });
    const options = { deployAutoConfirm: false, isAuthenticated: true };
    const metadata = { analysisStatus: 'requires_review' } as never;

    const action = (defaultNamingPolicy: 'ai_suggested' | 'manual_required' | 'ask_each_file') =>
      resolveQueueAnalysisAction(
        normalizeTenantUploadPolicy({
          ...DEFAULT_TENANT_UPLOAD_POLICY,
          emptyDocumentMode: 'auto_save',
          aiRenameEnabled: true,
          defaultNamingPolicy,
        }),
        metadata,
        vazio,
        options,
      );

    // Sem texto a IA não sugere nome; salvando direto, a confirmação recusava por nome inválido e
    // o item morria como erro — pior que a revisão, porque não explicava nada.
    assert.equal(action('manual_required'), 'open_review');
    assert.equal(action('ask_each_file'), 'open_review');
    assert.equal(action('ai_suggested'), 'auto_confirm');
  });
});

describe('sair do envio', () => {
  it('a fila oferece saída em qualquer ponto, menos durante a gravação', () => {
    const drawer = read('src/features/upload/UploadQueueDrawer.tsx');
    // Antes o "x" só existia para item terminado: quem percebia o engano na fila ou no meio da
    // análise tinha de esperar o documento entrar no acervo para então apagá-lo.
    assert.ok(drawer.includes("item.status !== 'confirming'"));
    assert.ok(drawer.includes('uploadQueueDrawer.cancelarEnvio'));
  });

  it('a revisão tem descartar, e não só "deixar para depois"', () => {
    const review = read('src/features/upload/review/ReviewDrawer.tsx');
    assert.ok(review.includes('reviewDrawer.descartarEnvio'));
    assert.ok(review.includes('removeItem(item.id)'));
    // E explica a folha vazia em vez de abrir com todos os campos em branco.
    assert.ok(review.includes('emptyDocument.title'));
  });
});

describe('o OCR completa o texto nativo, não o substitui', () => {
  const nativas = [
    { pageNumber: 1, text: 'Segue contrato de aluguel assinado em 2021.' },
    { pageNumber: 2, text: '' },
    { pageNumber: 25, text: 'CLÁUSULA DÉCIMA — do reajuste anual pelo IGP-M.' },
  ];

  it('página que o OCR não alcançou mantém o texto que já tinha', () => {
    /**
     * O OCR para no teto de `VISION_OCR_MAX_PAGES`. Devolvendo só o texto dele, um PDF de trinta
     * páginas com fotos no começo e contrato digitado na página 25 saía do OCR menor do que
     * entrou — e a cláusula sumia do documento.
     */
    const merged = mergeNativeAndOcrPages(nativas, [
      { pageNumber: 1, text: 'Segue contrato de aluguel assinado em 2021. RECIBO DE ALUGUEL' },
      { pageNumber: 2, text: 'CONTRATO DE LOCAÇÃO — fotografado' },
    ]);

    assert.match(merged.text, /CLÁUSULA DÉCIMA/);
    assert.match(merged.text, /RECIBO DE ALUGUEL/);
    assert.match(merged.text, /fotografado/);
    assert.equal(merged.charCount, merged.text.length);
  });

  it('o OCR vence na página em que leu, porque leu a página inteira renderizada', () => {
    const merged = mergeNativeAndOcrPages(
      [{ pageNumber: 1, text: 'bilhete digitado' }],
      [{ pageNumber: 1, text: 'bilhete digitado + tudo o que estava na foto' }],
    );

    assert.equal(merged.pages.length, 1);
    assert.match(merged.text, /tudo o que estava na foto/);
  });

  it('página em que o OCR não tirou nada não apaga o nativo', () => {
    const merged = mergeNativeAndOcrPages(nativas, [{ pageNumber: 1, text: '   ' }]);
    assert.match(merged.text, /Segue contrato de aluguel/);
  });

  it('as páginas saem em ordem, mesmo com o OCR chegando fora dela', () => {
    const merged = mergeNativeAndOcrPages(nativas, [{ pageNumber: 2, text: 'foto da página 2' }]);
    assert.deepEqual(
      merged.pages.map((page) => page.pageNumber),
      [1, 2, 25],
    );
  });
});

describe('a soma não escapa do teto de caracteres', () => {
  it('corta no limite e marca truncado', () => {
    /**
     * `extractTextFromPdf` corta o nativo em PDF_ANALYSIS_MAX_INPUT_CHARS e o OCR corta o dele por
     * conta própria, mas a soma não passava por corte nenhum — e o teto existe para segurar custo
     * e não estourar a janela de contexto da Groq.
     */
    const merged = mergeNativeAndOcrPages(
      [
        { pageNumber: 1, text: 'a'.repeat(60) },
        { pageNumber: 2, text: 'b'.repeat(60) },
        { pageNumber: 3, text: 'c'.repeat(60) },
      ],
      [],
      100,
    );

    assert.equal(merged.charCount <= 100, true, `passou do teto: ${merged.charCount}`);
    assert.ok(merged.truncated);
    // A primeira página inteira cabe; a segunda entra pela metade e a terceira nem começa.
    assert.deepEqual(
      merged.pages.map((page) => page.pageNumber),
      [1, 2],
    );
  });

  it('abaixo do teto nada é cortado', () => {
    const merged = mergeNativeAndOcrPages([{ pageNumber: 1, text: 'curto' }], [], 100);
    assert.equal(merged.truncated, false);
    assert.equal(merged.text, 'curto');
  });
});
