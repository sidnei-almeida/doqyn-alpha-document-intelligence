import 'dotenv/config';
import { connectRedisOnBoot } from '../redis/redisClient.js';
import { runAnalysisWorkerLoop } from './analysisWorker.js';
import { runEmbeddingWorkerLoop } from './embeddingWorker.js';
import { runChunkingWorkerLoop } from './chunkingWorker.js';
import { runStoragePromotionWorkerLoop } from './storagePromotionWorker.js';
import { configurePrometheusService, initPrometheusMetrics } from '../metrics/prometheus.js';
import { startStandaloneMetricsServer } from '../metrics/metricsServer.js';
import { installProcessGuards } from '../runtime/shutdown.js';

async function main() {
  installProcessGuards('doqyn-worker');
  configurePrometheusService({ serviceName: 'doqyn-worker', serviceRole: 'worker' });
  initPrometheusMetrics();
  startStandaloneMetricsServer('worker');
  await connectRedisOnBoot();
  await runAnalysisWorkerLoop();
  // Mesmo processo de propósito: o embedding mora onde a pilha de IA já mora, em vez de subir
  // um container só para carregar mais um modelo no mesmo VPS.
  await runEmbeddingWorkerLoop();
  // O fatiamento vem antes do embedding na vida do documento e sai do request da confirmação por
  // ser CPU — mesmo motivo, mesmo processo.
  await runChunkingWorkerLoop();
  // A cópia do provisório para a chave definitiva saiu da confirmação; é I/O dentro do R2, leve o
  // bastante para morar aqui junto.
  await runStoragePromotionWorkerLoop();
}

main().catch((error) => {
  console.error('Falha ao iniciar analysis worker:', error);
  process.exit(1);
});
