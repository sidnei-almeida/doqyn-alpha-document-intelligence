/**
 * A Biblioteca consome os mesmos endpoints reais da feature documents.
 * Este módulo apenas centraliza o que a library usa — sem mocks, sem contratos novos.
 */
export {
  listDocuments,
  fetchDocumentCategories,
  downloadDocument,
  triggerBlobDownload,
} from '@/features/documents/api/documentsApi';
