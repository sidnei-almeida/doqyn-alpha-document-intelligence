import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  toggleDocumentCategoryActive,
  updateDocumentCategory,
} from '../../server/services/documentCategoriesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const categoryId = typeof req.query.id === 'string' ? req.query.id : req.query.categoryId as string;

  if (!categoryId) {
    return res.status(400).json({ message: 'ID da categoria é obrigatório.', code: 'MISSING_ID' });
  }

  if (req.method === 'PATCH') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-categories/:categoryId',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const category = await updateDocumentCategory(
          companyId,
          categoryId,
          {
            name: body.name as string | undefined,
            description: body.description as string | undefined,
            keywords: body.keywords as string[] | undefined,
            negativeKeywords: body.negativeKeywords as string[] | undefined,
            examples: body.examples as string[] | undefined,
            iconKey: body.iconKey as string | undefined,
            color: body.color as string | undefined,
            sortOrder: body.sortOrder as number | undefined,
            active: body.active as boolean | undefined,
          },
          { ownerUserId: user.id },
        );

        logger.info('document category updated', {
          requestId,
          companyId,
          resource: 'document_categories',
          id: categoryId,
        });
        return { category };
      },
    });
  }

  if (req.method === 'DELETE') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-categories/:categoryId',
      handler: async ({ companyId, requestId, user }) => {
        const result = await toggleDocumentCategoryActive(companyId, categoryId, {
          ownerUserId: user.id,
        });
        if (result.active) {
          await updateDocumentCategory(companyId, categoryId, { active: false }, { ownerUserId: user.id });
        }
        logger.info('document category deactivated', {
          requestId,
          companyId,
          resource: 'document_categories',
          id: categoryId,
        });
        return { id: categoryId, active: false };
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
