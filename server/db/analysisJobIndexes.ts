import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

/**
 * Definição canônica dos índices de `analysis_jobs`.
 *
 * Eles existiam só em `scripts/ensure-mongodb-indexes.ts`, que é o caminho de operação: quem subia
 * pelo `setupMongo` ficava sem nenhum deles. Aqui vira uma lista só, importada pelos dois.
 *
 * `status + createdAt` é o que a posição na fila usa ("quantos entraram antes de mim e ainda não
 * começaram"), uma contagem que roda a cada consulta de status de cada arquivo em voo — sem índice,
 * é varredura da coleção inteira no processo que já está ocupado analisando. `status + completedAt`
 * é a janela de vazão que alimenta a estimativa.
 */
/**
 * O job é registro de trabalho, não histórico: o que importa dele já está no documento e na
 * trilha. Sem poda a coleção crescia a cada upload, para sempre, e junto com ela a contagem de
 * posição na fila, que varre por status.
 */
export const ANALYSIS_JOB_TTL_SECONDS = 30 * 24 * 60 * 60;

export const ANALYSIS_JOB_INDEXES: IndexDescription[] = [
  // A consulta de status carrega dono e tenant no filtro para não vazar job entre contas.
  { key: { tenantId: 1, ownerUserId: 1, createdAt: -1 } },
  { key: { tenantId: 1, status: 1, createdAt: -1 } },
  { key: { status: 1, createdAt: -1 } },
  { key: { status: 1, completedAt: -1 } },
  {
    key: { createdAt: 1 },
    expireAfterSeconds: ANALYSIS_JOB_TTL_SECONDS,
    name: 'analysis_jobs_ttl',
  },
];

export async function ensureAnalysisJobIndexes() {
  return ensureIndexesForCollection(SHARED_APP_COLLECTIONS.analysisJobs, ANALYSIS_JOB_INDEXES);
}
