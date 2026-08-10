import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentExtractionRule,
  listDocumentExtractionRules,
} from '../../server/services/documentExtractionRulesService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-extraction-rules',
      handler: async ({ companyId, requestId, user }) => {
        const rules = await listDocumentExtractionRules(companyId, { ownerUserId: user.id });
        logger.info('document extraction rules listed', {
          requestId,
          companyId,
          resource: 'document_extraction_rules',
          count: rules.length,
        });
        return { rules };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-extraction-rules',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          categoryId?: string;
          classId?: string;
          version?: number;
          active?: boolean;
          fields?: Array<Record<string, unknown>>;
          namingTemplate?: string;
          minimumConfidence?: number;
          expiryAlerts?: Record<string, unknown>;
        };

        const categoryId = body.categoryId?.trim() || body.classId?.trim();
        if (!categoryId || !body.fields || !body.namingTemplate) {
          return {
            status: 400,
            body: { message: 'categoryId, fields e namingTemplate são obrigatórios.', code: 'VALIDATION_ERROR' },
          };
        }

        const rule = await createDocumentExtractionRule(companyId, user.id, {
          categoryId,
          version: body.version,
          active: body.active,
          fields: body.fields as never,
          namingTemplate: body.namingTemplate,
          minimumConfidence: body.minimumConfidence,
          expiryAlerts: body.expiryAlerts as never,
        });

        logger.info('document extraction rule created', {
          requestId,
          companyId,
          resource: 'document_extraction_rules',
          id: rule.id,
        });
        return apiCreated({ rule });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
