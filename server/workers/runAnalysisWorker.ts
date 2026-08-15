import 'dotenv/config';
import { connectRedisOnBoot } from '../redis/redisClient.js';
import { runAnalysisWorkerLoop } from './analysisWorker.js';
import { runEmbeddingWorkerLoop } from './embeddingWorker.js';
import {
  configurePrometheusService,
  initPrometheusMetrics,
} from '../metrics/prometheus.js';
import { startStandaloneMetricsServer } from '../metrics/metricsServer.js';

async function main() {
  configurePrometheusService({ serviceName: 'doqyn-worker', serviceRole: 'worker' });
  initPrometheusMetrics();
  startStandaloneMetricsServer('worker');
  await connectRedisOnBoot();
  await runAnalysisWorkerLoop();
  // Mesmo processo de propósito: o embedding mora onde a pilha de IA já mora, em vez de subir
  // um container só para carregar mais um modelo no mesmo VPS.
  await runEmbeddingWorkerLoop();
}

main().catch((error) => {
  console.error('Falha ao iniciar analysis worker:', error);
  process.exit(1);
});
