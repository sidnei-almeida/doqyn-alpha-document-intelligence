import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentCategory,
  listDocumentCategories,
} from '../../server/services/documentCategoriesService.js';
import { createDefaultExtractionRuleForCategory } from '../../server/services/documentExtractionRulesService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-categories',
      handler: async ({ companyId, requestId, user }) => {
        const categories = await listDocumentCategories(companyId, { ownerUserId: user.id });
        logger.info('document categories listed', {
          requestId,
          companyId,
          resource: 'document_categories',
          count: categories.length,
        });
        return { categories };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-categories',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          name?: string;
          description?: string;
          keywords?: string[];
          negativeKeywords?: string[];
          examples?: string[];
          iconKey?: string;
          color?: string;
          slug?: string;
          sortOrder?: number;
        };

        const category = await createDocumentCategory(companyId, user.id, {
          name: body.name ?? '',
          description: body.description,
          keywords: body.keywords,
          negativeKeywords: body.negativeKeywords,
          examples: body.examples,
          iconKey: body.iconKey,
          color: body.color,
          slug: body.slug,
          sortOrder: body.sortOrder,
        });

        await createDefaultExtractionRuleForCategory(
          companyId,
          user.id,
          category.id,
          category.slug,
        );

        logger.info('document category created', {
          requestId,
          companyId,
          resource: 'document_categories',
          id: category.id,
        });
        return apiCreated({ category });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
