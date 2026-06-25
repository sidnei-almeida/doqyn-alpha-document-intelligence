import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDocument, listDocuments } from '../../server/services/documentService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { id, search, status, type, area, tenantId } = req.query;

    if (id && typeof id === 'string') {
      const tenant = typeof tenantId === 'string' ? tenantId : undefined;
      const document = await getDocument(id, tenant);
      if (!document) return res.status(404).json({ message: 'Documento não encontrado' });
      return res.status(200).json({ document });
    }

    const result = await listDocuments({
      tenantId: typeof tenantId === 'string' ? tenantId : undefined,
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      type: typeof type === 'string' ? type : undefined,
      area: typeof area === 'string' ? area : undefined,
    });

    return res.status(200).json(result);
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
