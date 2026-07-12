import 'dotenv/config';
import { startApiServer } from './apiServer.js';

startApiServer().catch((error) => {
  console.error('Falha ao iniciar API de produção:', error);
  process.exit(1);
});
