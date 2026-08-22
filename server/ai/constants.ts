export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_TEXT_CHARS = 50_000;
export const MIN_TEXT_CHARS = 300;

export const ALLOWED_PDF_MIME_TYPES = ['application/pdf'] as const;
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_PDF_MIME_TYPES,
  ...ALLOWED_IMAGE_MIME_TYPES,
] as const;

export const ALLOWED_ANALYSIS_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const;

export type AllowedAnalysisMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedAnalysisMimeType(mimeType: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function isImageAnalysisMimeType(mimeType: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isPdfAnalysisMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() === 'application/pdf';
}

export function extensionAllowedForAnalysis(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_ANALYSIS_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function resolveAnalysisMimeType(input: {
  fileName: string;
  mimeType?: string;
}): AllowedAnalysisMimeType | null {
  const mime = input.mimeType?.trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream' && isAllowedAnalysisMimeType(mime)) {
    return mime as AllowedAnalysisMimeType;
  }

  const lower = input.fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

export const CHUNK_SIZE = 1800;
export const CHUNK_OVERLAP = 250;
export const MAX_CHUNKS_FOR_CLASSIFICATION = 4;
export const MAX_CHUNKS_FOR_EXTRACTION = 8;
export const MAX_CHUNKS_PER_FIELD = 3;

/** Limites do prompt compacto de classificação (Etapa 5C). */
export const MAX_CLASSIFIER_CHUNKS = 5;
export const MAX_CHARS_PER_CLASSIFIER_CHUNK = 1200;
/**
 * Precisa acompanhar CHUNK_SIZE: enquanto era 1400 contra chunk de 1800, todo
 * chunk cheio perdia os últimos 400 chars antes de chegar ao modelo. O fecho do
 * documento (data de assinatura, vigência) mora na cauda do último chunk.
 */
export const MAX_CHARS_PER_EXTRACTOR_CHUNK = CHUNK_SIZE;
export const MAX_EXTRACTOR_FIELDS_IN_PROMPT = 12;
export const MAX_POSITIVE_KEYWORDS_PER_CLASS = 10;
export const MAX_NEGATIVE_KEYWORDS_PER_CLASS = 6;

export const MIN_CLASSIFICATION_CONFIDENCE = 0.7;
export const MIN_FIELD_CONFIDENCE = 0.6;
/** Confianca de campo calculado em codigo (ancora + prazo). Alta: a aritmetica e exata; o que
 *  pode falhar e a leitura da ancora ou do prazo, que ja carregam a propria confianca. */
export const DERIVED_FIELD_CONFIDENCE = 0.85;

/** @deprecated use MIN_CLASSIFICATION_CONFIDENCE */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = MIN_CLASSIFICATION_CONFIDENCE;

export const AI_ERROR_MESSAGES = {
  pdfOnly: 'Envie apenas arquivos PDF nesta etapa.',
  unsupportedFormat:
    'Envie PDF ou imagem (JPG, PNG ou WebP) nesta etapa.',
  fileTooLarge: 'O arquivo excede o limite de 15MB.',
  emptyFile: 'O arquivo enviado está vazio.',
  insufficientText:
    'Texto insuficiente ou não extraível. O documento pode ser escaneado ou baseado em imagem.',
  visionOcrFailed:
    'OCR automático falhou. O documento foi enviado para revisão manual.',
  visionOcrRequiredForImages:
    'Análise de imagens exige Vision OCR configurado. Ative VISION_OCR_ENABLED e as credenciais GCP.',
  rulesNotSeeded:
    'Não há classes e regras de documentos configuradas para esta empresa.',
  rulesNoCategories:
    'Crie ao menos uma categoria documental com critérios de classificação antes de analisar documentos.',
  rulesNoExtraction:
    'Configure ao menos uma regra de classificação/extração ativa para a categoria antes de analisar documentos.',
  rulesNoAccessConnections:
    'Conecte a categoria a um grupo documental e salve as alterações no mapa antes de analisar documentos.',
  analysisFailed: 'A análise automática falhou. Tente novamente.',
  classificationFailed:
    'Não foi possível concluir a classificação automática. O documento foi separado para revisão.',
  aiUnavailable:
    'Limite temporário da análise automática atingido. Aguarde alguns minutos e tente novamente.',
  aiUnavailableReviewReason:
    'Limite temporário da IA atingido. Tente novamente mais tarde.',
  groqDailyTokenLimit:
    'Cota diária de tokens do modelo Groq esgotada. Aguarde o reset da cota ou use um modelo menor (ex.: openai/gpt-oss-20b).',
  groqContextLimit:
    'O documento excede o limite de contexto do modelo. Reduza PDF_ANALYSIS_MAX_INPUT_CHARS ou envie um PDF menor.',
  groqRequestTimeout:
    'A análise automática demorou demais e foi interrompida. Tente novamente.',
  invalidAiResponse:
    'A resposta da IA veio em formato inválido. O documento foi marcado para revisão.',
  aiProviderNotConfigured:
    'O provedor de IA não está configurado. Configure GROQ_API_KEY para analisar documentos.',
  groqNotConfigured:
    'O provedor de IA não está configurado. Configure GROQ_API_KEY para analisar documentos.',
} as const;

export { DEFAULT_GROQ_MODEL } from './utils/aiConfig.js';

/**
 * Modo de retrieval ativo nesta etapa do projeto.
 * Chunks existem apenas em memória durante a análise — nunca persistidos.
 */
export const RETRIEVAL_MODE = 'hybrid' as const;
