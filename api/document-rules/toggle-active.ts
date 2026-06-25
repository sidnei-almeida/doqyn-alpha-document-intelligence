import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toggleDocumentRuleActive } from '../../server/services/documentRulesAdminService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/document-rules/:id/toggle-active',
    handler: async ({ companyId, requestId, params, user }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID da regra é obrigatório.', code: 'MISSING_ID' } };
      }

      const result = await toggleDocumentRuleActive(companyId, id, { ownerUserId: user.id });
      logger.info('document rule toggle-active', {
        requestId,
        companyId,
        resource: 'document_rules',
        id,
        active: result.active,
      });
      return result;
    },
  });
}
