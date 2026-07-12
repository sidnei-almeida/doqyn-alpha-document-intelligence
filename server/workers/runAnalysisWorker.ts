import 'dotenv/config';
import { connectRedisOnBoot } from '../redis/redisClient.js';
import { runAnalysisWorkerLoop } from './analysisWorker.js';

async function main() {
  await connectRedisOnBoot();
  await runAnalysisWorkerLoop();
}

main().catch((error) => {
  console.error('Falha ao iniciar analysis worker:', error);
  process.exit(1);
});
