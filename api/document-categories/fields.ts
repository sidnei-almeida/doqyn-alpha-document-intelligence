import type { VercelRequest, VercelResponse } from '@vercel/node';
import { canAnalyzeDocuments } from '../../server/auth/permissions.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { getMongoClassAndRule } from '../../server/services/documentRulesService.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

/**
 * Campos que a categoria espera, para quem está revisando um envio.
 *
 * A lista já existia, mas só em `/api/document-extraction-rules`, que é rota de administrador — o
 * funcionário que envia documento não consegue ler. Sem ela, escolher a categoria à mão deixava a
 * revisão cega: dava para dizer "é um contrato" e não dava para preencher o que falta num contrato.
 *
 * Aqui vai só o formulário — chave, rótulo, tipo, obrigatoriedade —, nada de configuração de regra.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  if (!canAnalyzeDocuments(auth.user)) {
    return res.status(403).json({
      message: 'Sem permissão para consultar campos de categoria.',
      code: 'FORBIDDEN',
    });
  }

  const categoryId =
    typeof req.query.categoryId === 'string'
      ? req.query.categoryId.trim()
      : typeof req.query.id === 'string'
        ? req.query.id.trim()
        : '';

  if (!categoryId) {
    return res
      .status(400)
      .json({ message: 'categoryId é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  try {
    const found = await getMongoClassAndRule({
      companyId: auth.ctx.tenantId,
      classId: categoryId,
      ownerUserId: auth.ctx.userId,
    });

    if (!found) {
      return res.status(404).json({
        message: 'Categoria sem regra ativa.',
        code: 'CLASS_OR_RULE_NOT_FOUND',
      });
    }

    return res.status(200).json({
      categoryId,
      categoryName: found.docClass.name,
      fields: (found.rule.fields ?? []).map((field) => ({
        key: field.key,
        label: field.label || field.key,
        type: field.type,
        required: Boolean(field.required),
        description: field.description,
      })),
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
