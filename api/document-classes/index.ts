import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentCategory,
  listDocumentCategories,
} from '../../server/services/documentCategoriesService.js';
import { createDefaultExtractionRuleForCategory } from '../../server/services/documentExtractionRulesService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

/** Compat: /api/document-classes → document_categories */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-classes',
      handler: async ({ companyId, requestId, user }) => {
        const categories = await listDocumentCategories(companyId, { ownerUserId: user.id });
        logger.info('document classes listed (compat)', {
          requestId,
          companyId,
          count: categories.length,
        });
        return {
          classes: categories.map((c) => ({
            ...c,
            permissions: { view: [], download: [], update: [], audit: [], share: [] },
          })),
        };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-classes',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const category = await createDocumentCategory(companyId, user.id, {
          name: (body.name as string) ?? '',
          description: body.description as string | undefined,
          keywords: body.keywords as string[] | undefined,
          negativeKeywords: body.negativeKeywords as string[] | undefined,
          iconKey: body.iconKey as string | undefined,
          color: body.color as string | undefined,
          slug: body.slug as string | undefined,
        });
        await createDefaultExtractionRuleForCategory(companyId, user.id, category.id, category.slug);
        logger.info('document class created (compat)', { requestId, companyId, id: category.id });
        return apiCreated({ class: { ...category, permissions: { view: [], download: [], update: [], audit: [], share: [] } } });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
