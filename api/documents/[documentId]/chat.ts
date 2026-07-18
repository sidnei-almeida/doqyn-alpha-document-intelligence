import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../../../server/tenancy/tenantQuery.js';
import { answerDocumentChatQuestion } from '../../../server/services/documentChatService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { isAiAnalysisError } from '../../../server/ai/utils/errors.js';
import type {
  DocumentChatClassification,
  DocumentChatHistoryMessage,
  DocumentChatMetadataField,
} from '../../../server/ai/utils/documentChatPrompt.js';
import type { MongoDocument, MongoDocumentVersion } from '../../../server/db/types.js';

const MAX_METADATA_FIELDS_IN_PROMPT = 8;

function buildMetadataFieldsForPrompt(
  metadata?: MongoDocumentVersion['metadata'],
): DocumentChatMetadataField[] | undefined {
  if (!metadata) return undefined;

  const fields = Object.values(metadata)
    .filter((field) => field.value !== null && field.value !== '')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_METADATA_FIELDS_IN_PROMPT)
    .map((field) => ({ label: field.label, value: field.value as string | number }));

  return fields.length > 0 ? fields : undefined;
}

function buildClassificationForPrompt(
  classification?: MongoDocumentVersion['classification'],
): DocumentChatClassification | undefined {
  if (!classification) return undefined;
  return { className: classification.className, confidence: classification.confidence };
}

function resolveDocumentId(req: VercelRequest): string | undefined {
  const fromQuery = req.query.documentId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

function readBody(req: VercelRequest): {
  question?: string;
  history?: DocumentChatHistoryMessage[];
} {
  const body = req.body as { question?: unknown; history?: unknown } | undefined;
  const question = typeof body?.question === 'string' ? body.question.trim() : undefined;

  const history = Array.isArray(body?.history)
    ? (body!.history as unknown[])
        .filter(
          (entry): entry is DocumentChatHistoryMessage =>
            !!entry &&
            typeof entry === 'object' &&
            (entry as { role?: unknown }).role !== undefined &&
            ((entry as { role?: unknown }).role === 'user' ||
              (entry as { role?: unknown }).role === 'assistant') &&
            typeof (entry as { content?: unknown }).content === 'string',
        )
        .map((entry) => ({ role: entry.role, content: entry.content }))
    : undefined;

  return { question, history };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveDocumentId(req);
  if (!documentId) {
    return res
      .status(400)
      .json({ message: 'documentId é obrigatório.', code: 'MISSING_DOCUMENT_ID' });
  }

  const { question, history } = readBody(req);
  if (!question) {
    return res.status(400).json({ message: 'question é obrigatória.', code: 'MISSING_QUESTION' });
  }

  try {
    const doc = await auth.ctx.collections.documents.findOne({
      _id: documentId,
      ...tenantScopeFilterFromContext(auth.ctx.storage),
      deletedAt: { $in: [null, undefined] },
      permanentlyDeletedAt: { $in: [null, undefined] },
      deactivatedAt: { $in: [null, undefined] },
    } as Record<string, unknown>);

    if (!doc) {
      return res
        .status(404)
        .json({ message: 'Documento não encontrado.', code: 'DOCUMENT_NOT_FOUND' });
    }

    assertCanAccessDocument(doc as Record<string, unknown>, auth.ctx.storage);

    const document = doc as MongoDocument;

    const version = await auth.ctx.collections.documentVersions.findOne({
      _id: document.currentVersionId,
      documentId,
    } as Record<string, unknown>);

    const result = await answerDocumentChatQuestion({
      ctx: auth.ctx,
      documentId,
      documentName: document.title,
      categoryName: document.className,
      question,
      history,
      requestId: req.headers['x-request-id'] as string | undefined,
      versionId: document.currentVersionId,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
      classification: buildClassificationForPrompt(version?.classification),
      metadataFields: buildMetadataFieldsForPrompt(version?.metadata),
      locale: req.headers['x-doqyn-locale'],
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error) || isAiAnalysisError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({ message: 'Erro ao processar pergunta no chat documental.' });
  }
}
