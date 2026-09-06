/**
 * Segunda opinião sobre a classificação.
 *
 * Motivada por um caso concreto: `rh_02_atestado_curto`. O mesmo atestado médico, com OCR
 * praticamente idêntico (723 e 737 caracteres), foi classificado como Recursos Humanos com 0.7 de
 * confiança na variante imagem e recusado com 0.0 nas outras duas — "documento médico (atestado)
 * não corresponde a nenhuma das classes definidas". Sem classe, a extração nem acontece: o
 * documento vai para revisão com `extraction: null`, e o que o modelo leu se perde.
 *
 * A recusa não vem de leitura ruim, vem de literalidade. A descrição da pasta "Recursos Humanos"
 * não cita atestado, e o classificador trata a descrição como definição fechada em vez de exemplo.
 * É essa a correção que este agente aplica: a classe é a prateleira onde o documento vai morar, e
 * a pergunta certa não é "esta descrição prevê este documento?", é "se eu tivesse que guardar isto
 * em uma destas pastas, qual seria?".
 *
 * Só roda quando a primeira classificação falhou. Documento classificado não paga nada.
 */
import type {
  ClassificationResult,
  DocumentClassRule,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import {
  completeJsonPromptWithUsage,
  EMPTY_TOKEN_USAGE,
  type GroqPromptContext,
  type TokenUsage,
} from './groqClient.js';
import { isGroqSaturationError } from '../utils/groqSaturation.js';
import { logger } from '../../utils/logger.js';

export type ClassificationReview = {
  /** Classe resgatada, ou null quando nenhuma serve mesmo. */
  classId: string | null;
  className: string | null;
  confidence: number;
  reason: string;
  usage: TokenUsage;
};

export function buildClassificationReviewPrompt(input: {
  chunks: RetrievedChunk[];
  classes: DocumentClassRule[];
  firstReason: string;
}): string {
  const classes = input.classes.map((entry) => ({
    id: entry.id,
    nome: entry.name,
    descricao: entry.description,
    palavrasChave: entry.keywords?.slice(0, 12),
  }));

  return `Um primeiro classificador não conseguiu encaixar este documento em nenhuma pasta e o
mandou para revisão manual. Você é a segunda opinião.

Motivo que ele deu: "${input.firstReason}"

Antes de concordar com ele, entenda o que está sendo perguntado. Estas não são definições
jurídicas nem categorias exaustivas — são PASTAS onde o documento vai ser arquivado, criadas por
pessoas da empresa. A descrição de cada pasta é exemplo do que costuma morar lá, não a lista
fechada do que pode morar lá.

A pergunta certa não é "a descrição desta pasta prevê este documento?". É: se alguém tivesse que
guardar este documento em uma destas pastas, e só nestas, em qual guardaria?

Um atestado médico de funcionário mora em Recursos Humanos, mesmo que a descrição de RH fale em
admissão e folha e não cite atestado. Uma procuração mora em Jurídico, mesmo que a descrição fale
em contratos. Recusar por falta de menção literal joga o documento na revisão manual por um
tecnicismo.

Ainda assim, forçar tem custo: documento arquivado na pasta errada some para quem procura.
Responda classId null quando nenhuma pasta faz sentido de verdade — não quando a descrição
simplesmente não cita o tipo.

Confiança: quanto você apostaria nessa escolha, de 0 a 1. Escolha defensável mas discutível fica
entre 0.6 e 0.8; escolha clara passa de 0.85.

Responda APENAS com JSON válido, sem markdown:
{"classId":"cat_rh__empresa","className":"Recursos Humanos","confidence":0.8,"reason":"atestado de afastamento de funcionária — documento de pessoal, ainda que a descrição da pasta não cite atestado"}

Pastas disponíveis:
${JSON.stringify(classes, null, 2)}

Trechos do documento:
${formatChunksForPrompt(input.chunks)}`;
}

export async function reviewFailedClassification(input: {
  chunks: RetrievedChunk[];
  classes: DocumentClassRule[];
  classification: ClassificationResult;
  context?: GroqPromptContext;
  model?: string;
}): Promise<ClassificationReview> {
  const nothing: ClassificationReview = {
    classId: null,
    className: null,
    confidence: 0,
    reason: input.classification.reason,
    usage: EMPTY_TOKEN_USAGE,
  };

  if (input.classes.length === 0) return nothing;

  try {
    const answer = await completeJsonPromptWithUsage(
      buildClassificationReviewPrompt({
        chunks: input.chunks,
        classes: input.classes,
        firstReason: input.classification.reason,
      }),
      {
        context: { ...input.context, operation: 'classification_review' },
        model: input.model,
      },
    );

    const parsed = safeParseJsonFromModel<Record<string, unknown>>(answer.content);
    const classId = typeof parsed?.classId === 'string' ? parsed.classId.trim() : '';

    // Classe inventada é pior que classe nenhuma: ela passa pelo resto do pipeline como se fosse
    // real e leva o documento para uma pasta que não existe.
    const matched = input.classes.find((entry) => entry.id === classId);
    if (!matched) {
      return { ...nothing, usage: answer.usage };
    }

    const confidence =
      typeof parsed?.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.6;

    return {
      classId: matched.id,
      className: matched.name,
      confidence,
      reason:
        typeof parsed?.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : 'Classe resgatada na segunda opinião.',
      usage: answer.usage,
    };
  } catch (error) {
    if (isGroqSaturationError(error)) {
      throw error;
    }

    logger.warn('segunda opinião da classificação falhou', {
      requestId: input.context?.requestId,
      jobId: input.context?.jobId,
      companyId: input.context?.companyId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return nothing;
  }
}
