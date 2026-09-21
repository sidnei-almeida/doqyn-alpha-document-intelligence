import type { AnalyzePdfResponse } from './analyzePdf';

/**
 * Códigos com que o servidor encerra a análise por falta de texto.
 *
 * `INSUFFICIENT_TEXT` é a folha em branco e o PDF que não tinha o que ler; `VISION_OCR_FAILED` é a
 * digitalização em que o OCR foi tentado e não devolveu nada. Os dois chegam à tela do mesmo jeito
 * — sem classe, sem resumo e sem nome sugerido —, e é por isso que a fila os trata junto.
 */
const EMPTY_DOCUMENT_CODES = ['INSUFFICIENT_TEXT', 'VISION_OCR_FAILED'] as const;

export type EmptyDocumentReason = (typeof EMPTY_DOCUMENT_CODES)[number];

/**
 * O documento voltou sem texto aproveitável?
 *
 * Antes isso passava calado: o arquivo era salvo com o nome original, sem resumo e sem categoria,
 * como se a análise tivesse dado certo. Quem enviou uma folha em branco por engano só descobria
 * abrindo a Biblioteca.
 */
export function emptyDocumentReason(raw: AnalyzePdfResponse): EmptyDocumentReason | null {
  /**
   * O código é o único sinal, de propósito.
   *
   * A tentação é adivinhar por `charCount === 0 && !extraction`, mas isso confunde "não havia
   * texto" com "a análise parou antes de extrair" — e qualquer resposta parcial passaria por
   * documento vazio. O servidor carimba um dos dois códigos sempre que encerra por falta de texto,
   * e é nele que a tela se apoia.
   */
  const code = raw.errorCode ?? raw.classification.errorCode;
  return EMPTY_DOCUMENT_CODES.find((entry) => entry === code) ?? null;
}
