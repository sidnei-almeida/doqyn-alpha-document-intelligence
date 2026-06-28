import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getDocumentGovernanceMatrix,
  updateDocumentGovernanceMatrixCell,
} from '../../server/services/documentGovernanceMatrixService.js';
import type { DocumentAccessPermissions } from '../../server/services/documentAccessRulesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-rules/matrix',
      handler: async ({ companyId, requestId, user }) => {
        const matrix = await getDocumentGovernanceMatrix(companyId, { ownerUserId: user.id });
        logger.info('document governance matrix loaded', {
          requestId,
          companyId,
          categories: matrix.categories.length,
          groups: matrix.groups.length,
          rules: matrix.rules.length,
        });
        return matrix;
      },
    });
  }

  if (req.method === 'PUT') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-rules/matrix',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          groupId?: string;
          categoryId?: string;
          classId?: string;
          permissions?: DocumentAccessPermissions;
        };

        const categoryId = body.categoryId?.trim() || body.classId?.trim();
        if (!body.groupId?.trim() || !categoryId || !body.permissions) {
          return {
            status: 400,
            body: {
              message: 'groupId, categoryId e permissions são obrigatórios.',
              code: 'INVALID_PAYLOAD',
            },
          };
        }

        try {
          const result = await updateDocumentGovernanceMatrixCell(companyId, user.id, {
            groupId: body.groupId.trim(),
            categoryId,
            permissions: body.permissions,
          });

          logger.info('document governance matrix updated', {
            requestId,
            companyId,
            groupId: body.groupId,
            categoryId,
          });

          return result;
        } catch (error) {
          if (isServiceError(error)) {
            return {
              status: error.statusCode,
              body: { message: error.message, code: error.code },
            };
          }
          throw error;
        }
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
