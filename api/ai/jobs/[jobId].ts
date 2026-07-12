import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompanyIdFromUser } from '../../../server/auth/companyContext.js';
import { canAnalyzeDocuments } from '../../../server/auth/permissions.js';
import { requireAuth } from '../../../server/auth/requireAuth.js';
import { getAnalysisJobForUser } from '../../../server/services/analysis/analysisJobService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!canAnalyzeDocuments(user)) {
    return res.status(403).json({ message: 'Sem permissão para consultar análises.' });
  }

  const jobId = String(req.query.jobId ?? '').trim();
  if (!jobId) {
    return res.status(400).json({ message: 'jobId é obrigatório.' });
  }

  const tenantId = getCompanyIdFromUser(user);
  const job = await getAnalysisJobForUser({
    jobId,
    tenantId,
    ownerUserId: user.id,
  });

  if (!job) {
    return res.status(404).json({ message: 'Job de análise não encontrado.', code: 'ANALYSIS_JOB_NOT_FOUND' });
  }

  return res.status(200).json(job);
}
