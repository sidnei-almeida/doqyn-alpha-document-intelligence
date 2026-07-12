import 'dotenv/config';
import { connectRedisOnBoot } from '../redis/redisClient.js';
import { runPreviewWorkerLoop } from './previewWorker.js';
import {
  configurePrometheusService,
  initPrometheusMetrics,
} from '../metrics/prometheus.js';
import { startStandaloneMetricsServer } from '../metrics/metricsServer.js';

async function main() {
  configurePrometheusService({
    serviceName: process.env.METRICS_SERVICE_NAME ?? 'doqyn-worker-preview',
    serviceRole: 'worker-preview',
  });
  initPrometheusMetrics();
  startStandaloneMetricsServer('worker-preview');
  await connectRedisOnBoot();
  await runPreviewWorkerLoop();
}

main().catch((error) => {
  console.error('Falha ao iniciar preview worker:', error);
  process.exit(1);
});
