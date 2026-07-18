import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  resolveApproximateGeo,
  resolveClientIp,
} from '../../server/services/tracking/securityContext.js';

export type DetectCountryResponse = {
  /** ISO 3166-1 alpha-2 (ex.: BR, PY, US, ES), ou null se não foi possível estimar pelo IP. */
  country: string | null;
};

/**
 * Endpoint público (sem auth — usado no formulário de cadastro, antes de existir sessão)
 * que sugere o país do visitante pelo IP (header cf-ipcountry ou GeoLite2 local). O
 * frontend usa isso só como sugestão de país no CountrySelect; o usuário sempre pode trocar.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const clientIp = resolveClientIp(req);
  const geo = resolveApproximateGeo(req, clientIp);

  const response: DetectCountryResponse = { country: geo.country ?? null };
  return res.status(200).json(response);
}
