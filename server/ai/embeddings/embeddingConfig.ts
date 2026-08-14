import path from 'node:path';

/**
 * Modelo de embedding do RAG documental.
 *
 * Roda local, por ONNX, dentro do worker — o texto do cliente nunca sai do servidor.
 * Essa é a razão de não usar Automated Embedding do Atlas nem Vertex: os dois mandam
 * o conteúdo para infraestrutura de terceiro, o que contraria o milestone de
 * confidencialidade do documento.
 */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/multilingual-e5-base';

/**
 * Dimensão do vetor. **Está travada na definição do índice do Atlas** — trocar o modelo
 * por outro de dimensão diferente exige recriar o índice e regerar todos os embeddings,
 * não é só mudar a variável. Por isso a checagem em `assertEmbeddingDimensions`.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** Nome do índice vetorial em `document_chunks`. */
export const VECTOR_INDEX_NAME = 'document_chunks_vector';

/**
 * A família e5 foi treinada com prefixo obrigatório e assimétrico: o trecho armazenado
 * entra como `passage:` e a pergunta como `query:`. Sem isso a recuperação degrada de
 * forma silenciosa — continua devolvendo resultado, só que pior.
 */
export const E5_PASSAGE_PREFIX = 'passage: ';
export const E5_QUERY_PREFIX = 'query: ';

/**
 * Precisão dos pesos ONNX.
 *
 * `fp32` baixa ~1,1 GB e carrega tudo isso em RAM — inviável no VPS, que roda API, dois
 * workers, Mongo e Redis no mesmo host. `q8` é o mesmo modelo quantizado para int8: ~4x
 * menor, com perda desprezível em recuperação, que depende da ordem dos vizinhos e não do
 * valor absoluto da similaridade.
 */
export const DEFAULT_EMBEDDING_DTYPE = 'q8';

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function getEmbeddingDtype(): string {
  return process.env.EMBEDDING_DTYPE?.trim() || DEFAULT_EMBEDDING_DTYPE;
}

export function isEmbeddingEnabled(): boolean {
  const raw = process.env.EMBEDDING_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Onde o ONNX baixado fica em disco. Fora de `node_modules` para sobreviver a `npm ci`. */
export function getEmbeddingCacheDir(): string {
  const raw = process.env.EMBEDDING_CACHE_DIR?.trim();
  if (raw) return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  return path.resolve(process.cwd(), '.cache/transformers');
}

/** Quantos chunks são vetorizados por lote. Lote grande economiza tempo e custa RAM. */
export function getEmbeddingBatchSize(): number {
  const parsed = Number(process.env.EMBEDDING_BATCH_SIZE);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 8;
}

export function assertEmbeddingDimensions(vector: number[], context: string): void {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding com ${vector.length} dimensões em ${context}; o índice ${VECTOR_INDEX_NAME} exige ${EMBEDDING_DIMENSIONS}. ` +
        'Trocar de modelo exige recriar o índice e regerar todos os vetores.',
    );
  }
}
