export type FieldType = 'string' | 'date' | 'currency' | 'number' | 'boolean';

export type DocumentRuleField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  aliases?: string[];
  examples?: string[];
};

export type DocumentClassRule = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  negativeKeywords?: string[];
  fields: DocumentRuleField[];
  namingTemplate: string;
};

export type EvidenceSnippet = {
  pageNumber?: number;
  snippet: string;
};

export type ClassificationResult = {
  classId: string | null;
  className: string | null;
  confidence: number;
  requiresReview: boolean;
  reason: string;
  evidence: EvidenceSnippet[];
  /** Código interno para diagnóstico (ex.: GROQ_RATE_LIMIT). */
  errorCode?: string;
  /** Motivo de revisão legível para UI/logs. */
  reviewReason?: string;
};

export type ExtractedMetadataField = {
  label: string;
  value: string | number | null;
  normalizedValue?: string | number | null;
  confidence: number;
  /** `manual` = preenchido por quem revisou o envio, antes de salvar. */
  source: 'document_text' | 'no_ai' | 'derived' | 'manual';
  evidence?: EvidenceSnippet;
  currency?: string;
};

export type MetadataExtractionResult = {
  documentType: string | null;
  version: string;
  metadata: Record<string, ExtractedMetadataField>;
  missingFields: string[];
  requiresReview: boolean;
  reviewReasons: string[];
};

export type ProcessingLogItem = {
  title: string;
  description: string;
  status: 'done' | 'active' | 'pending' | 'error';
};

export type AnalyzePdfResponse = {
  jobId: string;
  status: 'completed' | 'requires_review' | 'ai_unavailable' | 'failed';
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  recommendedFileName: string | null;
  textExtraction: {
    status: 'completed' | 'failed';
    pageCount?: number;
    charCount: number;
    truncated: boolean;
    source?: 'pdf_parse' | 'google_vision' | 'pdf_parse+google_vision';
    ocrFallbackUsed?: boolean;
    ocrPagesProcessed?: number;
    ocrDurationMs?: number;
  };
  classification: ClassificationResult;
  extraction: MetadataExtractionResult | null;
  logs: ProcessingLogItem[];
  /** Código de erro da análise quando aplicável. */
  errorCode?: string;
};

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type ExtractedPdfText = {
  text: string;
  pages: PdfPageText[];
  pageCount?: number;
  charCount: number;
  truncated: boolean;
  /** Origem da extração (pdf-parse e/ou Vision OCR). */
  source?: 'pdf_parse' | 'google_vision' | 'pdf_parse+google_vision';
  ocrFallbackUsed?: boolean;
  ocrPagesProcessed?: number;
  ocrDurationMs?: number;
};

export type DocumentChunk = {
  id: string;
  pageNumber?: number;
  chunkIndex: number;
  text: string;
  charStart?: number;
  charEnd?: number;
};

export type RetrievedChunk = DocumentChunk & {
  score: number;
  matchedTerms: string[];
  reason: string;
};

export type VersionComparisonSummary = {
  changedFields: string[];
  addedFields: string[];
  removedFields: string[];
  riskWarnings: string[];
  sameDocumentConfidence: number;
  mainChanges: string[];
};

export type VersionUpdateExtraction = MetadataExtractionResult & {
  versionComparison: VersionComparisonSummary;
  seemsSameDocument: boolean;
  sameDocumentConfidence: number;
  sameDocumentEvidence: string[];
  mainChanges: string[];
  changedFields: string[];
  riskWarnings: string[];
};

export type AnalyzePdfUpdateResponse = AnalyzePdfResponse & {
  updateMode: true;
  documentId: string;
  currentVersionLabel: string;
  expectedNextVersionLabel: string;
  previousVersionContextIncluded: boolean;
  extraction: VersionUpdateExtraction | null;
};
