import type {
  ClassificationResult,
  DocumentClassRule,
  MetadataExtractionResult,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import type { DocumentLanguageContext } from '../utils/detectDocumentLanguage.js';

export type DocumentAnalysisProviderName = 'groq' | 'google_vision';

export type AnalysisProviderContext = {
  requestId?: string;
  jobId: string;
  companyId: string;
  database?: string;
} & DocumentLanguageContext;

export interface DocumentAnalysisProvider {
  readonly name: DocumentAnalysisProviderName;
  isConfigured(): boolean;
  classify(input: {
    chunks: RetrievedChunk[];
    classes: DocumentClassRule[];
    context: AnalysisProviderContext;
  }): Promise<ClassificationResult>;
  extractMetadata(input: {
    chunks: RetrievedChunk[];
    selectedClass: DocumentClassRule;
    classification: ClassificationResult;
    context: AnalysisProviderContext;
  }): Promise<MetadataExtractionResult>;
}
