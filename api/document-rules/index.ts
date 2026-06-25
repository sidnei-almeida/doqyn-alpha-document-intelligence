import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentRule,
  listDocumentRules,
} from '../../server/services/documentRulesAdminService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';
import type { MongoRuleField } from '../../server/db/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-rules',
      handler: async ({ companyId, requestId, user }) => {
        const rules = await listDocumentRules(companyId, { ownerUserId: user.id });
        logger.info('document rules listed', {
          requestId,
          companyId,
          resource: 'document_rules',
          count: rules.length,
        });
        return { rules };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-rules',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          classId?: string;
          version?: number;
          active?: boolean;
          fields?: MongoRuleField[];
          namingTemplate?: string;
          minimumConfidence?: number;
        };

        if (!body.classId) {
          return {
            status: 400,
            body: { message: 'classId é obrigatório.', code: 'VALIDATION_ERROR' },
          };
        }

        const rule = await createDocumentRule(companyId, user.id, {
          classId: body.classId,
          version: body.version,
          active: body.active,
          fields: body.fields ?? [],
          namingTemplate: body.namingTemplate ?? '',
          minimumConfidence: body.minimumConfidence,
        });

        logger.info('document rule created', {
          requestId,
          companyId,
          resource: 'document_rules',
          id: rule.id,
          classId: rule.classId,
        });

        return apiCreated({ rule });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
