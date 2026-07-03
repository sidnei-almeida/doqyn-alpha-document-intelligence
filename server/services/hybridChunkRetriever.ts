/**
 * Retriever híbrido em memória para análise documental do DOQYN.
 *
 * Nesta etapa NÃO usamos FAISS, Atlas Vector Search, embeddings ou persistência
 * de chunks. O objetivo é selecionar trechos relevantes por regras de negócio
 * antes de enviar contexto reduzido à Groq.
 *
 * Futuro (quando necessário):
 * - chat documental / busca semântica global → document_chunks + embeddings
 * - FAISS persistente ou Atlas Vector Search
 * - Google Document AI / Vertex para OCR, layout e extração estruturada
 */
import {
  MAX_CHUNKS_FOR_CLASSIFICATION,
  MAX_CHUNKS_FOR_EXTRACTION,
  MAX_CHUNKS_PER_FIELD,
} from '../ai/constants.js';
import { extraRetrievalTermsForClass } from '../ai/utils/documentClassHeuristics.js';
import type {
  DocumentChunk,
  DocumentClassRule,
  DocumentRuleField,
  RetrievedChunk,
} from '../ai/types/documentAi.types.js';

const CNPJ_PATTERN = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const BRL_PATTERN = /R\$\s?[\d.,]+/gi;
const DATE_PATTERN = /\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
const NOTE_NUMBER_PATTERN = /(?:nota\s*fiscal|nf-?e?)\s*n[ºo°.]?\s*(\d{3,})/gi;
const ORDER_NUMBER_PATTERN = /(?:pedido|ordem\s*de\s*compra|oc)\s*n[ºo°.]?\s*(\d{3,})/gi;
const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

const LEGAL_COMMERCIAL_TERMS = [
  'contratante',
  'contratada',
  'fornecedor',
  'prestador',
  'vigência',
  'vigencia',
  'assinatura',
  'cláusula',
  'clausula',
  'valor total',
  'emissão',
  'emissao',
  'emitente',
  'destinatário',
  'destinatario',
  'objeto',
  'partes',
  'nota fiscal',
  'ordem de compra',
];

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const term of terms) {
    const normalized = term.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(term.trim());
  }

  return result;
}

function countOccurrences(text: string, term: string): number {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  if (!needle) return 0;

  let count = 0;
  let index = 0;
  while ((index = lower.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function hasProximitySignal(text: string, anchor: string, windowSize = 100): boolean {
  const lower = text.toLowerCase();
  const anchorLower = anchor.toLowerCase();
  const index = lower.indexOf(anchorLower);
  if (index === -1) return false;

  const slice = lower.slice(index, index + anchorLower.length + windowSize);
  return /[:=]|n[ºo°.]|cnpj|valor|total|r\$/i.test(slice);
}

function pagePositionBonus(pageNumber?: number): number {
  if (!pageNumber || pageNumber <= 0) return 0;
  if (pageNumber === 1) return 3;
  if (pageNumber === 2) return 2;
  if (pageNumber <= 4) return 1;
  return 0;
}

function applyPatternBonuses(text: string, matchedTerms: string[]): number {
  let score = 0;

  if (CNPJ_PATTERN.test(text)) {
    score += 4;
    matchedTerms.push('CNPJ');
  }
  CNPJ_PATTERN.lastIndex = 0;

  if (BRL_PATTERN.test(text)) {
    score += 3;
    matchedTerms.push('valor monetário');
  }
  BRL_PATTERN.lastIndex = 0;

  if (DATE_PATTERN.test(text)) {
    score += 2;
    matchedTerms.push('data');
  }
  DATE_PATTERN.lastIndex = 0;

  if (NOTE_NUMBER_PATTERN.test(text)) {
    score += 3;
    matchedTerms.push('número da nota');
  }
  NOTE_NUMBER_PATTERN.lastIndex = 0;

  if (ORDER_NUMBER_PATTERN.test(text)) {
    score += 3;
    matchedTerms.push('número do pedido');
  }
  ORDER_NUMBER_PATTERN.lastIndex = 0;

  if (CPF_PATTERN.test(text)) {
    score += 2;
    matchedTerms.push('CPF');
  }
  CPF_PATTERN.lastIndex = 0;

  return score;
}

function buildReason(matchedTerms: string[], context: 'classification' | 'extraction'): string {
  if (matchedTerms.length === 0) {
    return 'Nenhum termo relevante identificado neste trecho.';
  }

  const preview = matchedTerms.slice(0, 6).join(', ');
  return context === 'classification'
    ? `Trecho relevante para classificação (${preview}).`
    : `Trecho relevante para extração (${preview}).`;
}

function scoreTermsInChunk(
  chunk: DocumentChunk,
  terms: string[],
  options?: { negativeTerms?: string[]; proximity?: boolean },
): { score: number; matchedTerms: string[] } {
  const lower = chunk.text.toLowerCase();
  let score = 0;
  const matchedTerms: string[] = [];

  if (chunk.text.length < 50) {
    score -= 4;
  }

  score += pagePositionBonus(chunk.pageNumber);

  for (const term of terms) {
    const termLower = term.toLowerCase();
    if (termLower.length < 2) continue;

    const occurrences = countOccurrences(lower, termLower);
    if (occurrences === 0) continue;

    const termScore =
      termLower.length > 12 ? 5 : termLower.length > 7 ? 4 : termLower.length > 4 ? 3 : 2;
    score += termScore * Math.min(occurrences, 3);
    matchedTerms.push(term);

    if (options?.proximity && hasProximitySignal(chunk.text, term)) {
      score += 2;
      matchedTerms.push(`${term} (proximidade)`);
    }
  }

  for (const negative of options?.negativeTerms ?? []) {
    if (lower.includes(negative.toLowerCase())) {
      score -= 3;
    }
  }

  score += applyPatternBonuses(chunk.text, matchedTerms);

  const diversityBonus = new Set(matchedTerms.map((t) => t.toLowerCase())).size;
  score += Math.min(diversityBonus, 5);

  return { score: Math.max(score, 0), matchedTerms: uniqueTerms(matchedTerms) };
}

function toRetrievedChunk(
  chunk: DocumentChunk,
  score: number,
  matchedTerms: string[],
  context: 'classification' | 'extraction',
): RetrievedChunk {
  return {
    ...chunk,
    score,
    matchedTerms,
    reason: buildReason(matchedTerms, context),
  };
}

function sortAndLimit(chunks: RetrievedChunk[], limit: number): RetrievedChunk[] {
  return [...chunks]
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.pageNumber ?? 99) - (b.pageNumber ?? 99) ||
        a.chunkIndex - b.chunkIndex,
    )
    .slice(0, limit);
}

function fallbackChunks(
  chunks: DocumentChunk[],
  limit: number,
  context: 'classification' | 'extraction',
): RetrievedChunk[] {
  return chunks.slice(0, limit).map((chunk) =>
    toRetrievedChunk(chunk, 0, [], context),
  );
}

export function retrieveChunksForClassification(input: {
  chunks: DocumentChunk[];
  classes: DocumentClassRule[];
  topK?: number;
}): RetrievedChunk[] {
  const limit = input.topK ?? MAX_CHUNKS_FOR_CLASSIFICATION;
  const byId = new Map<string, RetrievedChunk>();

  for (const docClass of input.classes) {
    const classTerms = uniqueTerms([
      docClass.name,
      docClass.description,
      ...docClass.keywords,
      ...extraRetrievalTermsForClass(docClass),
    ]);
    const negativeTerms = docClass.negativeKeywords ?? [];

    for (const chunk of input.chunks) {
      const { score, matchedTerms } = scoreTermsInChunk(chunk, classTerms, { negativeTerms });
      if (score <= 0) continue;

      const retrieved = toRetrievedChunk(chunk, score, matchedTerms, 'classification');
      const existing = byId.get(chunk.id);
      if (!existing || retrieved.score > existing.score) {
        byId.set(chunk.id, retrieved);
      }
    }
  }

  const merged = sortAndLimit([...byId.values()], limit);
  return merged.length > 0 ? merged : fallbackChunks(input.chunks, limit, 'classification');
}

export function retrieveChunksForField(input: {
  chunks: DocumentChunk[];
  field: DocumentRuleField;
  selectedClass: DocumentClassRule;
  topK?: number;
}): RetrievedChunk[] {
  const limit = input.topK ?? MAX_CHUNKS_PER_FIELD;

  const terms = uniqueTerms([
    input.field.key,
    input.field.label,
    ...(input.field.description ? [input.field.description] : []),
    ...(input.field.aliases ?? []),
    ...(input.field.examples ?? []),
    ...input.selectedClass.keywords.slice(0, 4),
    ...LEGAL_COMMERCIAL_TERMS,
  ]);

  const scored = input.chunks.map((chunk) => {
    const { score, matchedTerms } = scoreTermsInChunk(chunk, terms, { proximity: true });
    return toRetrievedChunk(chunk, score, matchedTerms, 'extraction');
  });

  const positive = scored.filter((chunk) => chunk.score > 0);
  const top = sortAndLimit(positive, limit);

  return top.length > 0 ? top : fallbackChunks(input.chunks, limit, 'extraction');
}

export function retrieveChunksForExtraction(input: {
  chunks: DocumentChunk[];
  selectedClass: DocumentClassRule;
  topK?: number;
}): RetrievedChunk[] {
  const limit = input.topK ?? MAX_CHUNKS_FOR_EXTRACTION;
  const byId = new Map<string, RetrievedChunk>();

  for (const field of input.selectedClass.fields) {
    const fieldChunks = retrieveChunksForField({
      chunks: input.chunks,
      field,
      selectedClass: input.selectedClass,
    });

    for (const chunk of fieldChunks) {
      const existing = byId.get(chunk.id);
      if (!existing || chunk.score > existing.score) {
        byId.set(chunk.id, chunk);
      }
    }
  }

  const merged = sortAndLimit([...byId.values()], limit);
  return merged.length > 0 ? merged : fallbackChunks(input.chunks, limit, 'extraction');
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk) => {
      const page = chunk.pageNumber ?? '?';
      return `[página ${page}, trecho ${chunk.chunkIndex}]\n${chunk.text}`;
    })
    .join('\n\n---\n\n');
}

export type RetrievalStats = {
  totalChunks: number;
  classificationTopK: number;
  extractionTopK: number;
  classificationScores: number[];
  extractionScores: number[];
};

export function buildRetrievalStats(input: {
  totalChunks: number;
  classificationChunks: RetrievedChunk[];
  extractionChunks: RetrievedChunk[];
}): RetrievalStats {
  return {
    totalChunks: input.totalChunks,
    classificationTopK: input.classificationChunks.length,
    extractionTopK: input.extractionChunks.length,
    classificationScores: input.classificationChunks.map((c) => c.score),
    extractionScores: input.extractionChunks.map((c) => c.score),
  };
}
