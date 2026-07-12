import { createServer } from 'node:http';
import {
  getPrometheusContentType,
  isPrometheusEnabled,
  renderPrometheusMetrics,
} from './prometheus.js';
import { logger } from '../utils/logger.js';

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function getMetricsPort(): number {
  return readPositiveInt(process.env.METRICS_PORT, 9100);
}

export function startStandaloneMetricsServer(role: string): void {
  if (!isPrometheusEnabled()) return;

  const port = getMetricsPort();
  const server = createServer(async (req, res) => {
    if (req.url !== '/metrics' && req.url !== '/metrics/') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    try {
      const body = await renderPrometheusMetrics();
      res.statusCode = 200;
      res.setHeader('Content-Type', getPrometheusContentType());
      res.end(body);
    } catch (error) {
      logger.error('metrics render failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      res.statusCode = 500;
      res.end('metrics error');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info('Prometheus metrics server listening', { port, role });
  });
}
