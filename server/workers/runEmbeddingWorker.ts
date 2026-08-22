import 'dotenv/config';
import { connectRedisOnBoot } from '../redis/redisClient.js';
import { runEmbeddingWorkerLoop } from './embeddingWorker.js';
import { runChunkingWorkerLoop } from './chunkingWorker.js';

/**
 * Entrada dedicada da vetorização e do fatiamento.
 *
 * Em produção o loop também roda dentro do `runAnalysisWorker`, para não subir mais um container.
 * Esta entrada existe para o desenvolvimento: lá `ANALYSIS_SYNC_FALLBACK` é `true` por padrão, a
 * fila de análise não existe e o worker de análise aborta na largada — o embedding ficaria refém
 * de uma configuração que não tem nada a ver com ele.
 */
async function main() {
  await connectRedisOnBoot();
  await runEmbeddingWorkerLoop();
  await runChunkingWorkerLoop();
}

main().catch((error) => {
  console.error('Falha ao iniciar embedding worker:', error);
  process.exit(1);
});
