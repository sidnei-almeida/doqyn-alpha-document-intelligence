import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { buildDocumentRequestContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import {
  answerWhatChanged,
  queryDocumentRag,
  type DocumentRagQueryMode,
} from '../../server/services/documentRagQueryService.js';
import { assertCanAccessDocument } from '../../server/tenancy/tenantQuery.js';
import { tenantScopeFilterFromContext } from '../../server/tenancy/tenantQuery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId.trim() : '';
  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.' });
  }

  try {
    const docCtx = await buildDocumentRequestContext(user);
    const doc = await docCtx.collections.documents.findOne({
      _id: documentId,
      ...tenantScopeFilterFromContext(docCtx.storage),
      deletedAt: { $in: [null, undefined] },
    } as Record<string, unknown>);

    if (!doc) {
      return res.status(404).json({ message: 'Documento não encontrado.' });
    }

    assertCanAccessDocument(doc as Record<string, unknown>, docCtx.storage);

    const mode = (typeof req.query.mode === 'string' ? req.query.mode : 'current') as DocumentRagQueryMode;
    const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
    const versionLabel = typeof req.query.versionLabel === 'string' ? req.query.versionLabel : undefined;
    const compareVersionId =
      typeof req.query.compareVersionId === 'string' ? req.query.compareVersionId : undefined;
    const compareVersionLabel =
      typeof req.query.compareVersionLabel === 'string' ? req.query.compareVersionLabel : undefined;
    const fromVersionLabel =
      typeof req.query.fromVersionLabel === 'string' ? req.query.fromVersionLabel : undefined;

    if (mode === 'what_changed' && fromVersionLabel) {
      const answer = await answerWhatChanged({
        ctx: docCtx,
        documentId,
        fromVersionLabel,
        toVersionLabel:
          typeof req.query.toVersionLabel === 'string' ? req.query.toVersionLabel : undefined,
      });
      return res.status(200).json(answer);
    }

    const result = await queryDocumentRag({
      ctx: docCtx,
      documentId,
      mode: mode === 'what_changed' ? 'current' : mode,
      versionId,
      versionLabel,
      compareVersionId,
      compareVersionLabel,
      currentOnly: mode === 'current',
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({ message: 'Erro ao consultar RAG documental.' });
  }
}
