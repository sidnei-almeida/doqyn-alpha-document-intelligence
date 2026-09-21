/**
 * Terceiro passe da classificação: propor a pasta que falta.
 *
 * O primeiro classificador escolhe entre as pastas configuradas. O segundo
 * (`classificationReviewAgent`) reabre a pergunta quando o primeiro recusou por literalidade. Os
 * dois só sabem responder com uma pasta que já existe — e é por isso que um tenant recém-criado,
 * ou um tipo de documento que ninguém previu, sempre terminava em "Sem categoria".
 *
 * Este passe responde a outra pergunta: se nenhuma serve, qual deveria existir? A resposta não
 * vira pasta sozinha. Ela viaja como `ClassificationResult.suggestedCategory` e só se materializa
 * quando alguém clica na revisão, ou quando o tenant configurou `auto_create`.
 *
 * Só roda quando os dois passes anteriores falharam E o tenant ligou a sugestão. Documento
 * classificado não paga nada.
 */
import type {
  ClassificationResult,
  DocumentClassRule,
  RetrievedChunk,
  SuggestedCategory,
} from '../types/documentAi.types.js';
import { buildCategorySuggestionPrompt } from '../utils/categorySuggestionPrompt.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import {
  completeJsonPromptWithUsage,
  EMPTY_TOKEN_USAGE,
  type GroqPromptContext,
  type TokenUsage,
} from './groqClient.js';
import { isGroqSaturationError } from '../utils/groqSaturation.js';
import { logger } from '../../utils/logger.js';
import { slugifyName } from '../../utils/slugify.js';

export type CategorySuggestionOutcome = {
  suggestion: SuggestedCategory | null;
  usage: TokenUsage;
};

const NAME_MIN_CHARS = 3;
const NAME_MAX_CHARS = 40;
const NAME_MAX_WORDS = 3;
const DESCRIPTION_MIN_CHARS = 20;
const DESCRIPTION_MAX_CHARS = 200;
const MAX_KEYWORDS = 8;
const KEYWORD_MIN_CHARS = 2;
const KEYWORD_MAX_CHARS = 30;
const REASON_MAX_CHARS = 200;

/**
 * Nome que não separa nada de nada.
 *
 * Uma pasta "Documentos" aceita qualquer documento, então o próximo classificador vai mandar tudo
 * para lá — e a empresa troca "Sem categoria" por um sinônimo dela, com a diferença de que agora
 * parece resolvido. O prompt já pede para evitar; a guarda existe porque pedir não é garantir.
 */
const EMPTY_NAMES = new Set([
  'documento',
  'documentos',
  'arquivo',
  'arquivos',
  'outro',
  'outros',
  'diverso',
  'diversos',
  'geral',
  'gerais',
  'variado',
  'variados',
  'sem categoria',
  'document',
  'documents',
  'file',
  'files',
  'other',
  'others',
  'misc',
  'general',
  'otro',
  'otros',
  'varios',
]);

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseName(raw: unknown, classes: DocumentClassRule[]): string | null {
  if (typeof raw !== 'string') return null;

  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN_CHARS || name.length > NAME_MAX_CHARS) return null;
  if (name.split(' ').length > NAME_MAX_WORDS) return null;

  const comparable = normalizeForComparison(name);
  if (EMPTY_NAMES.has(comparable)) return null;

  // Duplicata pelo nome e pelo slug: "Notas Fiscais" e "notas-fiscais" são a mesma pasta, e a
  // criação recusaria a segunda com DUPLICATE_SLUG depois de já ter pago a chamada.
  const slug = slugifyName(name);
  if (!slug) return null;

  const collides = classes.some(
    (entry) =>
      normalizeForComparison(entry.name) === comparable || slugifyName(entry.name) === slug,
  );
  if (collides) return null;

  return name;
}

function parseDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length < DESCRIPTION_MIN_CHARS) return null;

  return text.length <= DESCRIPTION_MAX_CHARS
    ? text
    : `${text.slice(0, DESCRIPTION_MAX_CHARS).trimEnd()}…`;
}

function parseKeywords(raw: unknown, name: string): string[] {
  if (!Array.isArray(raw)) return [];

  const nameComparable = normalizeForComparison(name);
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const term = entry.replace(/\s+/g, ' ').trim().toLowerCase();
    if (term.length < KEYWORD_MIN_CHARS || term.length > KEYWORD_MAX_CHARS) continue;

    const comparable = normalizeForComparison(term);
    if (comparable === nameComparable || seen.has(comparable)) continue;

    seen.add(comparable);
    keywords.push(term);
    if (keywords.length >= MAX_KEYWORDS) break;
  }

  return keywords;
}

/**
 * Valida a resposta do modelo. Exportada para o teste cobrir a guarda sem chamar a Groq.
 */
export function parseCategorySuggestion(
  raw: unknown,
  classes: DocumentClassRule[],
): SuggestedCategory | null {
  const data = (raw ?? {}) as Record<string, unknown>;

  const name = parseName(data.name, classes);
  if (!name) return null;

  const description = parseDescription(data.description);
  if (!description) return null;

  const reason =
    typeof data.reason === 'string' && data.reason.trim()
      ? data.reason.replace(/\s+/g, ' ').trim().slice(0, REASON_MAX_CHARS)
      : 'Nenhuma das categorias configuradas cobre este tipo de documento.';

  return {
    name,
    description,
    keywords: parseKeywords(data.keywords, name),
    reason,
  };
}

export async function suggestCategoryForDocument(input: {
  chunks: RetrievedChunk[];
  classes: DocumentClassRule[];
  classification: ClassificationResult;
  context?: GroqPromptContext & { outputLocale?: string };
  model?: string;
}): Promise<CategorySuggestionOutcome> {
  const nothing: CategorySuggestionOutcome = { suggestion: null, usage: EMPTY_TOKEN_USAGE };

  try {
    const answer = await completeJsonPromptWithUsage(
      buildCategorySuggestionPrompt({
        chunks: input.chunks,
        classes: input.classes,
        documentType: input.classification.documentType,
        firstReason: input.classification.reason,
        outputLocale: input.context?.outputLocale,
      }),
      {
        context: { ...input.context, operation: 'category_suggestion' },
        model: input.model,
      },
    );

    const parsed = safeParseJsonFromModel<Record<string, unknown>>(answer.content);

    return {
      suggestion: parseCategorySuggestion(parsed, input.classes),
      usage: answer.usage,
    };
  } catch (error) {
    // Saturação sobe: quem chama decide degradar o documento, e engolir aqui transformaria fila
    // cheia em "a IA não soube propor nada", que é diagnóstico errado.
    if (isGroqSaturationError(error)) {
      throw error;
    }

    logger.warn('sugestão de categoria falhou', {
      requestId: input.context?.requestId,
      jobId: input.context?.jobId,
      companyId: input.context?.companyId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return nothing;
  }
}
