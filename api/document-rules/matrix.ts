import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  getDocumentGovernanceMatrix,
  updateDocumentGovernanceMatrixCell,
} from '../../server/services/documentGovernanceMatrixService.js';
import type { DocumentAccessPermissions } from '../../server/services/documentAccessRulesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { logger } from '../../server/utils/logger.js';

/**
 * Os campos persistidos herdaram os nomes `upload` e `manage` do primeiro desenho, enquanto o
 * domínio (e a resposta do próprio GET desta rota) fala `update` e `audit` — a tradução vive em
 * `server/tenancy/governanceAccessIndex.ts`. Sem validação, um corpo escrito a partir da resposta do
 * GET era gravado cru: a regra respondia 200, aparecia marcada na tela e não concedia nada, porque
 * o índice de autorização lê `upload`/`manage`.
 *
 * Aqui os dois vocabulários são aceitos e normalizados para o formato persistido, e qualquer chave
 * desconhecida derruba a requisição com 400 em vez de virar regra inerte.
 */
const permissionsSchema = z
  .object({
    view: z.boolean(),
    download: z.boolean(),
    share: z.boolean(),
    upload: z.boolean().optional(),
    manage: z.boolean().optional(),
    update: z.boolean().optional(),
    audit: z.boolean().optional(),
  })
  .strict()
  .transform((value) => ({
    view: value.view,
    download: value.download,
    share: value.share,
    upload: value.upload ?? value.update ?? false,
    manage: value.manage ?? value.audit ?? false,
  }));

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

        const parsedPermissions = permissionsSchema.safeParse(body.permissions);
        if (!parsedPermissions.success) {
          return {
            status: 400,
            body: {
              message:
                'Permissões inválidas. Use view, download, share e update/audit (ou upload/manage).',
              code: 'INVALID_PERMISSIONS',
              details: parsedPermissions.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            },
          };
        }

        try {
          const result = await updateDocumentGovernanceMatrixCell(companyId, user.id, {
            groupId: body.groupId.trim(),
            categoryId,
            permissions: parsedPermissions.data,
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
