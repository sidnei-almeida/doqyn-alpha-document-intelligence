import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  deleteDocumentCategory,
  updateDocumentCategory,
} from '../../server/services/documentCategoriesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';
import { isDocumentAdmin } from '../../server/tenancy/documentAccess.js';
import { ServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const categoryId =
    typeof req.query.id === 'string' ? req.query.id : (req.query.categoryId as string);

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
        /**
         * O portão mora aqui porque `withAdminMongoApi` não o tem.
         *
         * O nome do wrapper promete o que ele não faz: por dentro só chama `requireAuth`. Enquanto
         * o DELETE apenas desativava, isso passava despercebido; agora ele apaga a categoria, mata
         * as regras dela e reclassifica todo documento de dentro — irreversível, e a um clique de
         * qualquer membro autenticado.
         */
        if (!isDocumentAdmin(user)) {
          throw new ServiceError(
            'Somente administradores podem excluir categorias.',
            'CATEGORY_DELETE_FORBIDDEN',
            403,
          );
        }

        // Apagar de verdade: os documentos vão para Sem categoria, e as regras da categoria morrem
        // com ela. Antes isto só desativava, e a pasta desativada com documento dentro era um
        // estado que a tela não mostrava.
        const result = await deleteDocumentCategory(companyId, categoryId, user.id, {
          ownerUserId: user.id,
        });
        logger.info('document category deleted', {
          requestId,
          companyId,
          resource: 'document_categories',
          id: categoryId,
          movedDocuments: result.movedDocuments,
        });
        return result;
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
