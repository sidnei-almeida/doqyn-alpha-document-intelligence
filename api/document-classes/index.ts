import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentClass,
  listDocumentClasses,
} from '../../server/services/documentClassesService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-classes',
      handler: async ({ companyId, requestId, user }) => {
        const classes = await listDocumentClasses(companyId, { ownerUserId: user.id });
        logger.info('document classes listed', {
          requestId,
          companyId,
          resource: 'document_classes',
          count: classes.length,
        });
        return { classes };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-classes',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          name?: string;
          description?: string;
          keywords?: string[];
          negativeKeywords?: string[];
          iconKey?: string;
          color?: string;
          slug?: string;
        };
        const docClass = await createDocumentClass(companyId, user.id, {
          name: body.name ?? '',
          description: body.description,
          keywords: body.keywords,
          negativeKeywords: body.negativeKeywords,
          iconKey: body.iconKey,
          color: body.color,
          slug: body.slug,
        });
        logger.info('document class created', {
          requestId,
          companyId,
          resource: 'document_classes',
          id: docClass.id,
        });
        return apiCreated({ class: docClass });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
