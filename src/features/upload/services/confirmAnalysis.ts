/**
 * Adapter da feature upload para a confirmação de análise.
 * Mantém o contrato /api/documents/confirm-analysis intacto.
 */
export {
  confirmAnalysis,
  submitUploadForApproval,
  type ConfirmAnalysisOptions,
  type ConfirmAnalysisResponse,
  type SubmitUploadApprovalResponse,
} from '@/features/document-send/services/confirmAnalysis';
