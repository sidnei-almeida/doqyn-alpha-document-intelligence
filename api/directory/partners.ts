import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listPartnerTenants } from '../../server/services/directory/partnerTenantsService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    const partners = await listPartnerTenants(auth.ctx.tenantId);
    return res.status(200).json({ partners, total: partners.length });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
