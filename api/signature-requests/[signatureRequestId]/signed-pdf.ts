import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSignedPdfForRequest } from '../../../server/services/signatures/documentSignatureService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

function resolveId(req: VercelRequest): string | undefined {
  const value = req.query.signatureRequestId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const signatureRequestId = resolveId(req);
  if (!signatureRequestId) {
    return res.status(400).json({ message: 'signatureRequestId é obrigatório.', code: 'MISSING_ID' });
  }

  try {
    const file = await readSignedPdfForRequest(signatureRequestId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.status(200).send(file.buffer);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
