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
  /**
   * O que o documento É, segundo o próprio classificador — NDA, PROCURACAO, ATESTADO MEDICO.
   *
   * Existe porque escolher a pasta sem ter dito o tipo leva a classificar por semelhança
   * superficial: um NDA "estabelece obrigações entre partes" e cai em Contratos. Declarar o tipo
   * primeiro é o que separa "o que isto é" de "onde isto mora", e sobrevive à classe errada — o
   * atestado de `rh_02` foi lido como ATESTADO MÉDICO nas três variantes, inclusive nas duas em
   * que nenhuma pasta foi escolhida.
   */
  documentType?: string | null;
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

/**
 * Papéis de nomeação — o que o modelo entendeu do documento, em vez de campos que alguém
 * precisou autorar antes.
 *
 * Campo por classe não sobrevive a classe inventada pelo usuário: ninguém vai cadastrar os
 * campos de "desenho técnico" ou "receita" antes do primeiro upload. Estes três papéis existem
 * em qualquer documento, então o modelo de nome passa a valer para tipo que ninguém previu.
 */
export type DocumentNamingRoles = {
  /** O que o documento é, em uma ou duas palavras: NDA, RECEITA, NOTA FISCAL, DESENHO TECNICO. */
  tipo: string | null;
  /** Uma ou duas entidades que distinguem este documento de outro do mesmo tipo. */
  sujeitos: string[];
  /** Data que identifica o documento — assinatura, emissão, validade ou revisão (yyyy-mm-dd). */
  dataReferencia: string | null;
};

export type MetadataExtractionResult = {
  documentType: string | null;
  version: string;
  metadata: Record<string, ExtractedMetadataField>;
  missingFields: string[];
  requiresReview: boolean;
  reviewReasons: string[];
  /** Ausente quando o modelo não devolveu o bloco ou devolveu algo inaproveitável. */
  naming?: DocumentNamingRoles;
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
