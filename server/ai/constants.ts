export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_TEXT_CHARS = 50_000;
export const MIN_TEXT_CHARS = 300;
export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export const CHUNK_SIZE = 1800;
export const CHUNK_OVERLAP = 250;
export const MAX_CHUNKS_FOR_CLASSIFICATION = 4;
export const MAX_CHUNKS_FOR_EXTRACTION = 8;
export const MAX_CHUNKS_PER_FIELD = 3;

/** Limites do prompt compacto de classificação (Etapa 5C). */
export const MAX_CLASSIFIER_CHUNKS = 5;
export const MAX_CHARS_PER_CLASSIFIER_CHUNK = 1200;
export const MAX_CHARS_PER_EXTRACTOR_CHUNK = 1400;
export const MAX_EXTRACTOR_FIELDS_IN_PROMPT = 12;
export const MAX_POSITIVE_KEYWORDS_PER_CLASS = 10;
export const MAX_NEGATIVE_KEYWORDS_PER_CLASS = 6;

export const MIN_CLASSIFICATION_CONFIDENCE = 0.7;
export const MIN_FIELD_CONFIDENCE = 0.6;

/** @deprecated use MIN_CLASSIFICATION_CONFIDENCE */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = MIN_CLASSIFICATION_CONFIDENCE;

export const AI_ERROR_MESSAGES = {
  pdfOnly: 'Envie apenas arquivos PDF nesta etapa.',
  fileTooLarge: 'O arquivo excede o limite de 15MB.',
  emptyFile: 'O arquivo enviado está vazio.',
  insufficientText:
    'Texto insuficiente ou não extraível. O documento pode ser escaneado ou baseado em imagem.',
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
