import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import {
  MAX_CHARS_PER_CLASSIFIER_CHUNK,
  MAX_CLASSIFIER_CHUNKS,
  MAX_NEGATIVE_KEYWORDS_PER_CLASS,
  MAX_POSITIVE_KEYWORDS_PER_CLASS,
} from '../constants.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';

export type CompactDocumentClassForClassifier = {
  classId: string;
  className: string;
  description: string;
  keywords: string[];
  negativeKeywords: string[];
};

function truncateDescription(description: string, maxLength = 220): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function limitKeywords(keywords: string[], max: number): string[] {
  return keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function toCompactDocumentClass(docClass: DocumentClassRule): CompactDocumentClassForClassifier {
  return {
    classId: docClass.id,
    className: docClass.name,
    description: truncateDescription(docClass.description),
    keywords: limitKeywords(docClass.keywords, MAX_POSITIVE_KEYWORDS_PER_CLASS),
    negativeKeywords: limitKeywords(docClass.negativeKeywords ?? [], MAX_NEGATIVE_KEYWORDS_PER_CLASS),
  };
}

export function toCompactDocumentClasses(classes: DocumentClassRule[]): CompactDocumentClassForClassifier[] {
  return classes.map(toCompactDocumentClass);
}

export function limitClassifierChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.slice(0, MAX_CLASSIFIER_CHUNKS).map((chunk) => ({
    ...chunk,
    text:
      chunk.text.length > MAX_CHARS_PER_CLASSIFIER_CHUNK
        ? `${chunk.text.slice(0, MAX_CHARS_PER_CLASSIFIER_CHUNK)}…`
        : chunk.text,
  }));
}

/** Estimativa do prompt legado (com fields) — apenas para métricas de otimização. */
export function estimateLegacyClassifierPromptChars(
  chunks: RetrievedChunk[],
  classes: DocumentClassRule[],
): number {
  const legacyClassesJson = JSON.stringify(
    classes.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      keywords: c.keywords,
      negativeKeywords: c.negativeKeywords ?? [],
      expectedFields: c.fields.map((f) => f.key),
    })),
  );
  const base = 900 + legacyClassesJson.length + formatChunksForPrompt(chunks).length;
  return base;
}

export function buildCompactClassifierPrompt(
  chunks: RetrievedChunk[],
  classes: DocumentClassRule[],
): { prompt: string; compactChunks: RetrievedChunk[]; compactClasses: CompactDocumentClassForClassifier[] } {
  const compactClasses = toCompactDocumentClasses(classes);
  const compactChunks = limitClassifierChunks(chunks);
  const classesJson = JSON.stringify(compactClasses);

  const prompt = `Classifique o documento usando apenas as classes abaixo.

Regras:
- Use somente classId da lista.
- Se não houver confiança suficiente, requiresReview=true e classId=null.
- Responda apenas JSON válido.

Classes:
${classesJson}

Trechos:
${formatChunksForPrompt(compactChunks)}

Formato:
{"classId":"id_ou_null","className":"nome_ou_null","confidence":0.0,"requiresReview":false,"reason":"curta","evidence":[{"pageNumber":1,"snippet":"trecho"}]}`;

  return { prompt, compactChunks, compactClasses };
}
