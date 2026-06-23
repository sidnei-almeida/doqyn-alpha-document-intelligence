export type UploadMode = 'single' | 'bulk';

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
  suggestedName: string;
  documentType: string;
  responsible?: string;
  supplier?: string;
  documentDate?: string;
  value?: string;
  suggestedVersion: string;
  confidenceScore: number;
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
  lastActionAt: string;
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
