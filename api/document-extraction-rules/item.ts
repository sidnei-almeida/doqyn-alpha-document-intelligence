import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateDocumentExtractionRule } from '../../server/services/documentExtractionRulesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ruleId = typeof req.query.id === 'string' ? req.query.id : '';

  if (!ruleId) {
    return res.status(400).json({ message: 'ID da regra é obrigatório.', code: 'MISSING_ID' });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-extraction-rules/:ruleId',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const rule = await updateDocumentExtractionRule(
          companyId,
          ruleId,
          {
            fields: body.fields as never,
            namingTemplate: body.namingTemplate as string | undefined,
            minimumConfidence: body.minimumConfidence as number | undefined,
            active: body.active as boolean | undefined,
            expiryAlerts: body.expiryAlerts as never,
          },
          { ownerUserId: user.id },
        );

        logger.info('document extraction rule updated', {
          requestId,
          companyId,
          resource: 'document_extraction_rules',
          id: ruleId,
        });
        return { rule };
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
