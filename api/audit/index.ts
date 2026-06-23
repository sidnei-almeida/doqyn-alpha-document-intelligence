import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listAuditEvents } from '../../server/services/auditService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { tenantId, documentId } = req.query;

  const result = await listAuditEvents({
    tenantId: typeof tenantId === 'string' ? tenantId : undefined,
    documentId: typeof documentId === 'string' ? documentId : undefined,
  });

  return res.status(200).json(result);
}
