import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateDocumentRule } from '../../server/services/documentRulesAdminService.js';
import type { MongoRuleField } from '../../server/db/types.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/document-rules/:id',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID da regra é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as {
        fields?: MongoRuleField[];
        namingTemplate?: string;
        minimumConfidence?: number;
        active?: boolean;
      };

      const rule = await updateDocumentRule(companyId, id, body);
      logger.info('document rule updated', {
        requestId,
        companyId,
        resource: 'document_rules',
        id,
      });
      return { rule };
    },
  });
}
