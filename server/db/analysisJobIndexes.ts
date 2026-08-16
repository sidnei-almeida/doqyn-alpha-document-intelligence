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
export const ANALYSIS_JOB_INDEXES: IndexDescription[] = [
  // A consulta de status carrega dono e tenant no filtro para não vazar job entre contas.
  { key: { tenantId: 1, ownerUserId: 1, createdAt: -1 } },
  { key: { tenantId: 1, status: 1, createdAt: -1 } },
  { key: { status: 1, createdAt: -1 } },
  { key: { status: 1, completedAt: -1 } },
];

export async function ensureAnalysisJobIndexes() {
  return ensureIndexesForCollection(SHARED_APP_COLLECTIONS.analysisJobs, ANALYSIS_JOB_INDEXES);
}
