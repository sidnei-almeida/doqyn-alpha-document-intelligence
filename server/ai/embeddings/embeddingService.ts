import { logger } from '../../utils/logger.js';
import {
  assertEmbeddingDimensions,
  E5_PASSAGE_PREFIX,
  E5_QUERY_PREFIX,
  getEmbeddingBatchSize,
  getEmbeddingCacheDir,
  getEmbeddingDtype,
  getEmbeddingModel,
} from './embeddingConfig.js';

type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * O modelo pesa ~280 MB e leva alguns segundos para carregar. Fica em singleton por
 * processo: o worker paga o custo uma vez e reaproveita em todo job seguinte.
 */
async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = getEmbeddingCacheDir();

      const model = getEmbeddingModel();
      const dtype = getEmbeddingDtype();
      const startedAt = Date.now();
      logger.info('embedding_model_loading', { model, dtype, cacheDir: env.cacheDir });

      const extractor = (await pipeline('feature-extraction', model, {
        dtype,
      } as never)) as unknown as FeatureExtractionPipeline;

      logger.info('embedding_model_loaded', { model, dtype, durationMs: Date.now() - startedAt });
      return extractor;
    })().catch((error) => {
      // Sem isto, uma falha de download deixaria a promise rejeitada em cache e todo
      // job seguinte falharia sem nem tentar de novo.
      pipelinePromise = null;
      throw error;
    });
  }

  return pipelinePromise;
}

export function resetEmbeddingPipelineForTests(): void {
  pipelinePromise = null;
}

async function embedPrefixed(texts: string[], prefix: string): Promise<number[][]> {
  if (!texts.length) return [];

  const extractor = await getPipeline();
  const batchSize = getEmbeddingBatchSize();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize).map((text) => prefix + text);
    const output = await extractor(batch, { pooling: 'mean', normalize: true });
    for (const vector of output.tolist()) {
      assertEmbeddingDimensions(vector, `lote iniciado em ${start}`);
      vectors.push(vector);
    }
  }

  return vectors;
}

/** Vetoriza trechos para armazenamento. Usa o prefixo `passage:` da família e5. */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  return embedPrefixed(texts, E5_PASSAGE_PREFIX);
}

/** Vetoriza a pergunta do usuário. Usa o prefixo `query:` — assimétrico ao de armazenamento. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedPrefixed([text], E5_QUERY_PREFIX);
  if (!vector) throw new Error('Falha ao gerar embedding da consulta.');
  return vector;
}
