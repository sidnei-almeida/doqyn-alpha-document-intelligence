/**
 * Ponto de entrada da feature upload para o serviço de análise.
 * A implementação permanece em document-send até a migração completa;
 * este adapter evita reescrever o contrato /api/ai/analyze-pdf.
 */
export {
  analyzePdf,
  AnalyzePdfRequestError,
  type AnalysisQueueStatus,
  type AnalyzePdfOptions,
  type AnalyzePdfResponse,
} from '@/features/document-send/services/analyzePdf';
