import 'dotenv/config';
import { startApiServer } from './apiServer.js';
import { installProcessGuards, onShutdown } from './runtime/shutdown.js';

installProcessGuards('doqyn-api-dev');

startApiServer()
  .then((server) => {
    onShutdown('http server', () => new Promise<void>((resolve) => server.close(() => resolve())));
  })
  .catch((error) => {
    console.error('Falha ao iniciar API local:', error);
    process.exit(1);
  });
