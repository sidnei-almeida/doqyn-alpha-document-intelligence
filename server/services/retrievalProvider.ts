/**
 * Camada de abstração para retrieval documental.
 *
 * Modo ativo nesta etapa: "hybrid" (scoring em memória por regras/regex).
 *
 * Modos futuros (NÃO implementados):
 * - "faiss"          → índice vetorial local/persistente para busca semântica
 * - "atlas_vector"   → MongoDB Atlas Vector Search com embeddings
 * - "google"         → Google Document AI / Vertex Agent Search
 *
 * Quando Google Document AI entrar, poderá substituir ou complementar:
 * extração de texto, OCR, layout, classificação e extração estruturada.
 *
 * Quando houver chat documental ou busca global por cláusulas, criar:
 * document_chunks, embeddings e escolher faiss | atlas_vector | google.
 */
import { RETRIEVAL_MODE } from '../ai/constants.js';
import type { DocumentChunk, DocumentClassRule, RetrievedChunk } from '../ai/types/documentAi.types.js';
import {
  buildRetrievalStats,
  formatChunksForPrompt,
  retrieveChunksForClassification,
  retrieveChunksForExtraction,
  type RetrievalStats,
} from './hybridChunkRetriever.js';

export type RetrievalMode = 'hybrid' | 'faiss' | 'atlas_vector' | 'google';

export function getRetrievalMode(): RetrievalMode {
  return RETRIEVAL_MODE;
}

function assertHybridMode(): void {
  if (getRetrievalMode() !== 'hybrid') {
    throw new Error(
      `Modo de retrieval "${getRetrievalMode()}" ainda não implementado nesta etapa do projeto.`,
    );
  }
}

export function selectChunksForClassification(input: {
  chunks: DocumentChunk[];
  classes: DocumentClassRule[];
  topK?: number;
}): RetrievedChunk[] {
  assertHybridMode();
  return retrieveChunksForClassification(input);
}

export function selectChunksForExtraction(input: {
  chunks: DocumentChunk[];
  selectedClass: DocumentClassRule;
  topK?: number;
}): RetrievedChunk[] {
  assertHybridMode();
  return retrieveChunksForExtraction(input);
}

export { formatChunksForPrompt, buildRetrievalStats };
export type { RetrievalStats };
