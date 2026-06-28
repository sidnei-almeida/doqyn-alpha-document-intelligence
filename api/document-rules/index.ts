import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listDocumentAccessRules,
  upsertAccessRule,
  type DocumentAccessPermissions,
} from '../../server/services/documentAccessRulesService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-rules',
      handler: async ({ companyId, requestId, user }) => {
        const rules = await listDocumentAccessRules(companyId, { ownerUserId: user.id });
        logger.info('document access rules listed', {
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
          groupId?: string;
          categoryId?: string;
          permissions?: DocumentAccessPermissions;
        };

        if (!body.groupId?.trim() || !body.categoryId?.trim() || !body.permissions) {
          return {
            status: 400,
            body: {
              message: 'groupId, categoryId e permissions são obrigatórios.',
              code: 'INVALID_PAYLOAD',
            },
          };
        }

        const rule = await upsertAccessRule(companyId, user.id, {
          groupId: body.groupId.trim(),
          categoryId: body.categoryId.trim(),
          permissions: body.permissions,
        });

        logger.info('document access rule upserted', {
          requestId,
          companyId,
          resource: 'document_rules',
          groupId: body.groupId,
          categoryId: body.categoryId,
        });
        return apiCreated({ rule });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
