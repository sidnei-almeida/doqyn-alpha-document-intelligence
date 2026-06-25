export type SendFlowPhase =
  | 'idle'
  | 'analyzing'
  | 'completing'
  | 'completed'
  | 'saving'
  | 'saved'
  | 'error';

export type ProcessingStatus =
  | 'waiting'
  | 'validating'
  | 'processing'
  | 'metadata_extracted'
  | 'name_generated'
  | 'requires_review'
  | 'confirmed'
  | 'error';

export type HistoryStatus =
  | 'processed'
  | 'metadata_confirmed'
  | 'requires_review'
  | 'analyzing'
  | 'error';

export type ExtractedMetadata = {
  jobId?: string;
  originalFileName?: string;
  suggestedName: string;
  documentType: string;
  responsible?: string;
  supplier?: string;
  documentDate?: string;
  value?: string;
  suggestedVersion: string;
  confidenceScore: number;
  analysisStatus: 'completed' | 'requires_review' | 'ai_unavailable' | 'failed';
  missingFields?: string[];
  reviewReasons?: string[];
  savedDocumentId?: string;
  savedVersionId?: string;
  documentCode?: string;
  storageStatus?: 'pending' | 'stored' | 'failed' | 'skipped';
  extractedFields?: {
    key: string;
    label: string;
    value: string;
    confidence?: number;
    evidence?: {
      snippet: string;
      pageNumber?: number;
    };
  }[];
  classificationEvidence?: {
    snippet: string;
    pageNumber?: number;
  }[];
  classificationReason?: string;
  textExtraction?: {
    status: 'completed' | 'failed';
    pageCount?: number;
    charCount: number;
    truncated: boolean;
  };
};

export type UploadedDocument = {
  id: string;
  originalName: string;
  suggestedName?: string;
  fileSize: number;
  mimeType: string;
  category?: string;
  status: ProcessingStatus;
  version?: string;
  uploadedAt: string;
  lastActionAt: string;
  metadata?: ExtractedMetadata;
};

export type DocumentHistoryItem = {
  id: string;
  originalName: string;
  suggestedName: string;
  category: string;
  status: HistoryStatus;
  confidenceScore: number;
  version: string;
  uploadedAt: string;
  uploadedAtIso?: string;
  lastActionAt: string;
  lastActionLabel?: string;
  fileSize?: number;
  metadata?: ExtractedMetadata;
  logs?: ProcessingLogItem[];
  errorMessage?: string;
};

export type MetadataField = {
  label: string;
  value: string;
};

export type ProcessingLogItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  status: 'done' | 'active' | 'pending' | 'error';
};

/** @deprecated Usar ExtractedMetadata */
export type DocumentStatus = HistoryStatus;

export type DocumentCategory =
  | 'Contrato'
  | 'Nota Fiscal'
  | 'Boleto'
  | 'Comprovante'
  | 'Proposta Comercial'
  | 'Declaração'
  | 'Indefinido';
