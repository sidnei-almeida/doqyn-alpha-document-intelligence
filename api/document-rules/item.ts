import type { VercelRequest, VercelResponse } from '@vercel/node';
import { upsertAccessRule } from '../../server/services/documentAccessRulesService.js';
import type { DocumentAccessPermissions } from '../../server/services/documentAccessRulesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'PATCH' || req.method === 'PUT') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-rules/:id',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          groupId?: string;
          categoryId?: string;
          permissions?: DocumentAccessPermissions;
          active?: boolean;
        };

        if (!body.groupId?.trim() || !body.categoryId?.trim()) {
          return {
            status: 400,
            body: { message: 'groupId e categoryId são obrigatórios.', code: 'VALIDATION_ERROR' },
          };
        }

        const permissions = body.permissions ?? {
          view: false,
          download: false,
          upload: false,
          share: false,
          manage: false,
        };

        if (body.active === false) {
          permissions.view = false;
          permissions.download = false;
          permissions.upload = false;
          permissions.share = false;
          permissions.manage = false;
        }

        const rule = await upsertAccessRule(companyId, user.id, {
          groupId: body.groupId.trim(),
          categoryId: body.categoryId.trim(),
          permissions,
        });

        logger.info('document access rule updated', {
          requestId,
          companyId,
          resource: 'document_rules',
          groupId: body.groupId,
          categoryId: body.categoryId,
        });
        return { rule };
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
