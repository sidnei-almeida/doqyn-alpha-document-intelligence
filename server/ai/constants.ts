export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_TEXT_CHARS = 50_000;
export const MIN_TEXT_CHARS = 300;
export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export const CHUNK_SIZE = 1800;
export const CHUNK_OVERLAP = 250;
export const MAX_CHUNKS_FOR_CLASSIFICATION = 5;
export const MAX_CHUNKS_FOR_EXTRACTION = 10;
export const MAX_CHUNKS_PER_FIELD = 4;

/** Limites do prompt compacto de classificação (Etapa 5C). */
export const MAX_CLASSIFIER_CHUNKS = 5;
export const MAX_CHARS_PER_CLASSIFIER_CHUNK = 1200;
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
    'Classes e regras ativas não encontradas no MongoDB. Execute npm run db:setup para popular o banco.',
  analysisFailed: 'A análise automática falhou. Tente novamente.',
  classificationFailed:
    'Não foi possível concluir a classificação automática. O documento foi separado para revisão.',
  aiUnavailable:
    'Limite temporário da análise automática atingido. Aguarde alguns minutos e tente novamente.',
  aiUnavailableReviewReason:
    'Limite temporário da IA atingido. Tente novamente mais tarde.',
  noAiProductionBlocked: 'AI_MODE=no_ai is not allowed in production.',
  noAiClassRuleNotFound:
    'Classe ou regra de desenvolvimento não encontrada. Rode npm run db:setup.',
  invalidAiResponse:
    'A resposta da IA veio em formato inválido. O documento foi marcado para revisão.',
  groqNotConfigured: 'Análise automática indisponível. Configure GROQ_API_KEY no servidor.',
} as const;

export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Modo de retrieval ativo nesta etapa do projeto.
 * Chunks existem apenas em memória durante a análise — nunca persistidos.
 */
export const RETRIEVAL_MODE = 'hybrid' as const;
