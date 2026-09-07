import { AI_ERROR_MESSAGES } from '../constants.js';
import type { AnalyzePdfResponse, ClassificationResult } from '../types/documentAi.types.js';
import type { ExtractedDocumentText } from './documentTextExtractor.js';
import type { ProcessingLogItem } from '../types/documentAi.types.js';
import { getVisionOcrMinTextChars } from '../vision/visionConfig.js';

export function isVisionOcrFailure(extracted: ExtractedDocumentText): boolean {
  return extracted.ocrErrorCode === 'VISION_OCR_FAILED';
}

/** OCR tentado (ou falhou) e texto ainda abaixo do mínimo — não dá para seguir a Groq. */
export function isInsufficientTextAfterOcr(extracted: ExtractedDocumentText): boolean {
  if (extracted.charCount >= getVisionOcrMinTextChars()) return false;
  return isVisionOcrFailure(extracted) || extracted.ocrAttempted === true;
}

/**
 * Texto que a máquina não conseguiu ler → revisão manual, não erro.
 *
 * Isto já foi `status: 'failed'`, e o motivo escrito aqui era evitar "beco sem saída de
 * requires_review sem classId": a confirmação exigia classe, a análise não tinha nenhuma para
 * dar, e o documento ficava preso. O beco foi fechado do outro lado — `ReviewDrawer` passou a
 * cobrar a categoria de quem envia (`needsManualCategory`), e `normalizeConfirmPayload` aceita
 * `manualClassId` no lugar da classe da IA.
 *
 * Fechado o beco, `failed` virou a resposta errada. Um PDF escaneado que o OCR não leu continua
 * sendo um documento perfeitamente utilizável: quem envia abre, reconhece, escolhe a categoria e
 * preenche a ficha à mão. Errar o arquivo obrigava a pessoa a reenviar o mesmo PDF para receber o
 * mesmo erro — a máquina não ia ler daquela vez também.
 *
 * O `errorCode` continua indo junto, e é ele que explica na tela por que não veio classificação.
 */
export function buildTextExtractionReviewResponse(input: {
  jobId: string;
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  extracted: ExtractedDocumentText;
  logs: ProcessingLogItem[];
  errorCode: 'VISION_OCR_FAILED' | 'INSUFFICIENT_TEXT';
  reason: string;
}): AnalyzePdfResponse {
  const classification: ClassificationResult = {
    classId: null,
    className: null,
    confidence: 0,
    // Sem texto não há como sugerir classe, e é justamente isso que a revisão resolve.
    requiresReview: true,
    reason: input.reason,
    errorCode: input.errorCode,
    evidence: [],
  };

  return {
    jobId: input.jobId,
    status: 'requires_review',
    errorCode: input.errorCode,
    originalFileName: input.originalFileName,
    fileHash: input.fileHash,
    fileSizeBytes: input.fileSizeBytes,
    recommendedFileName: null,
    textExtraction: {
      status: input.extracted.charCount > 0 ? 'completed' : 'failed',
      pageCount: input.extracted.pageCount,
      charCount: input.extracted.charCount,
      truncated: input.extracted.truncated,
      source: input.extracted.source,
      ocrFallbackUsed: input.extracted.ocrFallbackUsed,
      ocrPagesProcessed: input.extracted.ocrPagesProcessed,
      ocrDurationMs: input.extracted.ocrDurationMs,
    },
    classification,
    extraction: null,
    logs: [
      ...input.logs,
      {
        title: input.errorCode === 'VISION_OCR_FAILED' ? 'OCR falhou' : 'Texto insuficiente',
        description: input.reason,
        status: 'error',
      },
    ],
  };
}

/** Atalho para o caso do OCR — o mais comum dos dois, e o que tem mensagem própria. */
export function buildVisionOcrFailedReviewResponse(input: {
  jobId: string;
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  extracted: ExtractedDocumentText;
  logs: ProcessingLogItem[];
}): AnalyzePdfResponse {
  return buildTextExtractionReviewResponse({
    ...input,
    errorCode: 'VISION_OCR_FAILED',
    reason: AI_ERROR_MESSAGES.visionOcrFailed,
  });
}
