import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getPrometheusContentType,
  isPrometheusEnabled,
  renderPrometheusMetrics,
} from '../server/metrics/prometheus.js';

function isProductionRuntime(): boolean {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  return process.env.NODE_ENV === 'production' || appEnv === 'production';
}

function isAuthorized(req: VercelRequest): boolean {
  const token = process.env.METRICS_TOKEN?.trim();

  // Em produção, token é obrigatório — sem token = scrape fechado.
  if (!token) {
    return !isProductionRuntime();
  }

  const authHeader = req.headers.authorization?.trim() ?? '';
  if (authHeader === `Bearer ${token}`) return true;

  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  return queryToken.length > 0 && queryToken === token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  if (!isPrometheusEnabled()) {
    return res.status(404).json({ message: 'Métricas desabilitadas' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  const body = await renderPrometheusMetrics();
  res.setHeader('Content-Type', getPrometheusContentType());
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(body);
}
